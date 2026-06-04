/**
 * ApiMart Provider 实现
 *
 * 基于 ApiMart gpt-image-2 异步图像生成接口实现。
 * 文生图、图生图和融合生图统一提交到 /images/generations，
 * Provider 内部负责任务提交、状态轮询和结果提取。
 */

import {
  BaseProvider,
  type GenerationOptions,
  type ProviderCapabilities,
  type ProviderConfig,
} from "./base.ts";
import type {
  GenerationResult,
  ImageData,
  ImageGenerationRequest,
  ImagesBlendRequest,
  Message,
  MessageContentItem,
  NonStandardImageContentItem,
} from "../types/index.ts";
import { ApiMartConfig, getProviderTaskDefaults } from "../config/manager.ts";
import { buildDataUri, fetchWithTimeout, urlToBase64 } from "../utils/index.ts";
import { parseErrorMessage } from "../core/error-handler.ts";
import {
  debug,
  error as logError,
  info,
  logFullPrompt,
  logImageGenerationComplete,
  logImageGenerationFailed,
  logImageGenerationStart,
  logInputImages,
} from "../core/logger.ts";
import { withApiTiming } from "../middleware/timing.ts";

type ApiMartStatus = "submitted" | "processing" | "completed" | "failed" | "cancelled";

interface ApiMartSubmitResponse {
  code?: number;
  message?: string;
  data?: Array<{
    status?: string;
    task_id?: string;
  }>;
}

interface ApiMartTaskResponse {
  code?: number;
  message?: string;
  data?: {
    id?: string;
    status?: string;
    progress?: number;
    error?: unknown;
    result?: {
      images?: Array<{
        url?: string | string[];
        expires_at?: string;
      }>;
    };
  };
}

const APIMART_RESOLUTIONS = new Set(["1k", "2k", "4k"]);
const APIMART_DEFAULT_TIMEOUT_MS = 300000;

export class ApiMartProvider extends BaseProvider {
  override readonly name = "ApiMart" as const;

  override readonly capabilities: ProviderCapabilities = {
    textToImage: true,
    imageToImage: true,
    multiImageFusion: true,
    asyncTask: true,
    maxInputImages: 16,
    maxOutputImages: 16,
    maxNativeOutputImages: 1,
    maxEditOutputImages: 16,
    maxBlendOutputImages: 16,
    outputFormats: ["url", "b64_json"],
  };

  override readonly config: ProviderConfig = {
    apiUrl: ApiMartConfig.apiUrl,
    textModels: ApiMartConfig.textModels,
    defaultModel: ApiMartConfig.defaultModel,
    defaultSize: ApiMartConfig.defaultSize,
    defaultCount: ApiMartConfig.defaultCount,
    defaultResolution: ApiMartConfig.defaultResolution,
    editModels: ApiMartConfig.textModels,
    defaultEditModel: ApiMartConfig.defaultModel,
    defaultEditSize: ApiMartConfig.defaultSize,
    defaultEditCount: ApiMartConfig.defaultEditCount,
    defaultEditResolution: ApiMartConfig.defaultEditResolution,
    blendModels: ApiMartConfig.blendModels || ApiMartConfig.textModels,
    defaultBlendModel: ApiMartConfig.defaultBlendModel || ApiMartConfig.defaultModel,
    defaultBlendSize: ApiMartConfig.defaultBlendSize || ApiMartConfig.defaultSize,
    defaultBlendCount: ApiMartConfig.defaultBlendCount,
    defaultBlendResolution: ApiMartConfig.defaultBlendResolution,
  };

  /**
   * ApiMart Key 常见为通用 sk- 形态，容易与 NewApi / Pollinations 冲突。
   * 首版不做裸 Key 自动识别，后端模式通过 Key 池显式选择 ApiMart。
   */
  override detectApiKey(_apiKey: string): boolean {
    return false;
  }

  override async generate(
    apiKey: string,
    request: ImageGenerationRequest,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    const hasImages = request.images.length > 0;
    const n = this.selectCount(request.n, hasImages);
    const requestWithCount = { ...request, n };

    return await this.generateWithConcurrency(
      apiKey,
      requestWithCount,
      options,
      async (singleRequest) => {
        const startTime = Date.now();
        const model = this.selectModel(singleRequest.model, hasImages);
        const size = this.selectSize(singleRequest.size, hasImages);
        const task = hasImages ? "edit" : "text";
        const resolution = this.selectResolution(singleRequest.resolution, task);
        const prompt = singleRequest.prompt || "A beautiful image";

        logFullPrompt(this.name, options.requestId, prompt);
        if (hasImages) {
          logInputImages(this.name, options.requestId, singleRequest.images);
        }
        logImageGenerationStart(this.name, options.requestId, model, size, prompt.length);

        const body: Record<string, unknown> = {
          model,
          prompt,
          n: 1,
          size,
          resolution,
        };

        if (hasImages) {
          body.image_urls = singleRequest.images.map((image) => this.normalizeImageInput(image));
        }

        debug(
          this.name,
          `[${options.requestId}] 提交任务参数: ${
            JSON.stringify({
              model,
              size,
              resolution,
              hasImages,
              imageCount: singleRequest.images.length,
            })
          }`,
        );

        return await this.submitAndPoll(apiKey, body, singleRequest, options, startTime, model);
      },
    );
  }

  override blend(
    apiKey: string,
    request: ImagesBlendRequest,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    const extracted = this.extractPromptAndImagesFromMessages(request.messages || []);
    const prompt = request.prompt || extracted.prompt || "";
    const defaults = getProviderTaskDefaults(this.name, "blend");
    const model = request.model || this.config.defaultBlendModel || this.config.defaultModel;

    return this.generate(apiKey, {
      prompt,
      images: extracted.images,
      model,
      size: request.size || defaults.size || this.config.defaultBlendSize ||
        this.config.defaultSize,
      n: request.n || defaults.n || this.config.defaultBlendCount,
      response_format: request.response_format,
      steps: request.steps,
      resolution: request.resolution || defaults.resolution || this.config.defaultBlendResolution,
    }, options);
  }

  override getSupportedModels(): string[] {
    const models = [
      ...this.config.textModels,
      ...(this.config.editModels || []),
      ...(this.config.blendModels || []),
    ];
    return [...new Set(models)];
  }

  private selectResolution(
    requestResolution: string | undefined,
    task: "text" | "edit" | "blend",
  ): string {
    if (requestResolution && APIMART_RESOLUTIONS.has(requestResolution)) {
      return requestResolution;
    }

    const defaults = getProviderTaskDefaults(this.name, task);
    if (defaults.resolution && APIMART_RESOLUTIONS.has(defaults.resolution)) {
      return defaults.resolution;
    }

    if (task === "edit" && this.config.defaultEditResolution) {
      return this.config.defaultEditResolution;
    }
    if (task === "blend" && this.config.defaultBlendResolution) {
      return this.config.defaultBlendResolution;
    }

    return this.config.defaultResolution || "1k";
  }

  private normalizeImageInput(image: string): string {
    if (image.startsWith("http://") || image.startsWith("https://") || image.startsWith("data:")) {
      return image;
    }
    return buildDataUri(image, "image/png");
  }

  private async submitAndPoll(
    apiKey: string,
    requestBody: Record<string, unknown>,
    originalRequest: ImageGenerationRequest,
    options: GenerationOptions,
    startTime: number,
    model: string,
  ): Promise<GenerationResult> {
    const { requestId } = options;
    const submitUrl = `${this.config.apiUrl}/images/generations`;

    const submitResponse = await withApiTiming(
      this.name,
      "generate_image",
      () =>
        fetchWithTimeout(submitUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }, options.timeoutMs),
    );

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      const friendlyError = parseErrorMessage(errorText, submitResponse.status, this.name);
      logImageGenerationFailed(this.name, requestId, friendlyError);
      throw new Error(friendlyError);
    }

    const submitData = await submitResponse.json() as ApiMartSubmitResponse;
    const taskId = submitData.data?.[0]?.task_id || "";
    if (!taskId) {
      const message = submitData.message || JSON.stringify(submitData);
      const errMsg = `ApiMart 任务提交失败：未返回 task_id。${message}`;
      logImageGenerationFailed(this.name, requestId, errMsg);
      throw new Error(errMsg);
    }

    info(this.name, `[${requestId}] 任务已提交, Task ID: ${taskId}`);

    const outputUrls = await this.pollTask(apiKey, taskId, options);
    const duration = Date.now() - startTime;
    const images = await this.buildImageResults(outputUrls, originalRequest, options);

    logImageGenerationComplete(this.name, requestId, images.length, duration);

    return {
      success: true,
      images,
      model,
      provider: this.name,
      duration,
    };
  }

  private async pollTask(
    apiKey: string,
    taskId: string,
    options: GenerationOptions,
  ): Promise<string[]> {
    const requestId = options.requestId;
    const timeoutMs = Math.max(
      options.timeoutMs ?? APIMART_DEFAULT_TIMEOUT_MS,
      APIMART_DEFAULT_TIMEOUT_MS,
    );
    const start = Date.now();
    let attempt = 0;

    await this.delay(Math.min(10000, Math.max(3000, Math.floor(timeoutMs / 6))));

    while (Date.now() - start < timeoutMs) {
      attempt++;
      const response = await withApiTiming(
        this.name,
        "poll_task",
        () =>
          fetchWithTimeout(`${this.config.apiUrl}/tasks/${taskId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
            },
          }, timeoutMs),
      );

      if (!response.ok) {
        const errorText = await response.text();
        const friendlyError = parseErrorMessage(errorText, response.status, this.name);
        logImageGenerationFailed(this.name, requestId, friendlyError);
        throw new Error(friendlyError);
      }

      const taskData = await response.json() as ApiMartTaskResponse;
      const data = taskData.data;
      const status = data?.status as ApiMartStatus | undefined;

      if (attempt <= 3 || attempt % 10 === 0) {
        info(
          this.name,
          `[${requestId}] 轮询任务 ${taskId} 第 ${attempt} 次: ${status ?? "unknown"}`,
        );
      }

      if (status === "completed") {
        const urls = this.extractImageUrls(taskData);
        if (urls.length === 0) {
          throw new Error(`ApiMart Task Completed but no image URL returned: ${taskId}`);
        }
        return urls;
      }

      if (status === "failed" || status === "cancelled") {
        const reason = data?.error ?? taskData.message ?? JSON.stringify(taskData);
        logImageGenerationFailed(this.name, requestId, `Task ${status}: ${String(reason)}`);
        throw new Error(`ApiMart Task ${status}: ${String(reason)}`);
      }

      await this.delay(3000);
    }

    logImageGenerationFailed(this.name, requestId, `任务超时: ${taskId}`);
    throw new Error(`ApiMart Task Timeout: ${taskId}`);
  }

  private extractImageUrls(taskData: ApiMartTaskResponse): string[] {
    const images = taskData.data?.result?.images;
    if (!Array.isArray(images)) return [];

    const urls: string[] = [];
    for (const image of images) {
      if (typeof image.url === "string" && image.url) {
        urls.push(image.url);
      } else if (Array.isArray(image.url)) {
        urls.push(...image.url.filter((url): url is string => typeof url === "string" && !!url));
      }
    }

    return urls;
  }

  private async buildImageResults(
    urls: string[],
    request: ImageGenerationRequest,
    options: GenerationOptions,
  ): Promise<ImageData[]> {
    const shouldReturnBase64 = options.returnBase64 || request.response_format === "b64_json";
    const images: ImageData[] = [];

    for (const url of urls) {
      if (!shouldReturnBase64) {
        images.push({ url });
        continue;
      }

      try {
        const { base64 } = await urlToBase64(url);
        images.push({ b64_json: base64 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(this.name, `[${options.requestId}] URL 转 Base64 失败，返回 URL: ${msg}`);
        images.push({ url });
      }
    }

    return images;
  }

  private extractPromptAndImagesFromMessages(
    messages: Message[],
  ): { prompt: string; images: string[] } {
    const images: string[] = [];

    for (const msg of messages) {
      if (!Array.isArray(msg.content)) continue;
      for (const item of msg.content) {
        if (item.type === "image_url" && item.image_url?.url) {
          images.push(item.image_url.url);
        }
        if (item.type === "image") {
          const nonStandard = item as NonStandardImageContentItem;
          const mediaType = nonStandard.mediaType || "image/png";
          images.push(
            nonStandard.image.startsWith("data:")
              ? nonStandard.image
              : buildDataUri(nonStandard.image, mediaType),
          );
        }
      }
    }

    return {
      prompt: this.extractPromptFromLastUserMessage(messages),
      images,
    };
  }

  private extractPromptFromLastUserMessage(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg || msg.role !== "user") continue;

      if (typeof msg.content === "string") return msg.content.trim();
      if (Array.isArray(msg.content)) {
        const parts: string[] = [];
        for (const item of msg.content as MessageContentItem[]) {
          if (item.type === "text") parts.push(item.text);
        }
        return parts.join(" ").trim();
      }
    }
    return "";
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const apiMartProvider = new ApiMartProvider();
