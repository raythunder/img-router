# Add ApiMart Channel Settings - Design

## 总体方案

新增独立 `ApiMartProvider`，在现有 Provider 注册表、配置管理、管理端渠道设置和 Key 池页面中接入。业务 handler 继续只面向 `IProvider` 调度，不感知 ApiMart 上游协议。

这个方案遵循：

- KISS：沿用现有 Provider 扩展点，不新增框架或调度层。
- YAGNI：只接入 `gpt-image-2` 图片生成，不做视频、余额、自定义网关或模型发现。
- DRY：复用 `BaseProvider.generateWithConcurrency()`、现有图片 URL/base64 工具、现有 Key 池 API。
- SOLID：ApiMart 上游协议由 `ApiMartProvider` 单独负责，handler 和 registry 保持原职责。

## 后端边界

### Provider 类型与注册

需要修改：

- `src/providers/base.ts`：`ProviderName` 增加 `"ApiMart"`。
- `src/types/provider.ts`：共享 `ProviderType` 增加 `"ApiMart"`。
- `src/providers/apimart.ts`：新增 Provider 实现与单例 `apiMartProvider`。
- `src/providers/registry.ts`：注册 `apiMartProvider`，并纳入启动摘要。

### 配置结构

需要修改 `src/config/manager.ts`：

- `ApiKeysConfig` 增加 `apimart: string`，保留静态配置兼容。
- `AppConfig.providers` 增加 `apimart: BaseProviderConfig` 或独立 `ApiMartConfig`。
- `DEFAULT_CONFIG.providers.apimart`：
  - `enabled: true` 或 `false` 需结合现有默认策略。推荐 `true`，但无 Key 时后端模式会显示缺 Key。
  - `apiUrl: "https://api.apimart.ai/v1"`。
  - `defaultModel: "gpt-image-2"`。
  - `defaultSize: "1:1"`。
  - `defaultCount: 1`。
  - `defaultEditCount: 1`。
  - `textModels/editModels/blendModels: ["gpt-image-2"]`。
- `DEFAULT_RUNTIME_CONFIG.providers.ApiMart`：
  - `enabled: true`。
  - `text/edit/blend` 默认使用 `gpt-image-2`、`1:1`、`n: 1`、合理 `weight`。
- `DEFAULT_RUNTIME_CONFIG.keyPools.ApiMart = []`。
- `ALL_TEXT_MODELS` 纳入 `APIMART_MODELS`。
- `replaceRuntimeConfig()` 内部同步 Provider 状态的局部 `ProviderName` 类型要增加 `ApiMart`。

如需支持 `resolution`，当前 `ProviderTaskDefaults` 没有该字段。推荐最小扩展：

- `ProviderTaskDefaults` 增加 `resolution?: string | null`。
- `ProviderTaskDefaultsPatch` 自动继承。
- `sanitizeRuntimeConfig()` 的 defaults 白名单增加 `resolution`。
- 前端保存时仍写入 `providers.ApiMart.{task}.resolution`。

这比创建 ApiMart 专属配置结构更直接，也能复用当前渠道设置保存逻辑。

## ApiMartProvider 契约

### 能力

建议能力声明：

```ts
{
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
}
```

### 请求映射

ImgRouter 标准请求到 ApiMart：

- `model`：`selectModel()`，默认 `gpt-image-2`。
- `prompt`：标准 `request.prompt`，空值回退到现有 Provider 风格的安全默认提示词。
- `n`：单次上游请求固定 `1`，多张由 `generateWithConcurrency()` 拆分。
- `size`：传 ApiMart 支持的比例值，例如 `1:1`、`16:9`；如果请求传像素尺寸，首版可原样透传，失败由上游返回错误。
- `resolution`：从 task defaults 读取，默认 `1k`。
- `image_urls`：当 `request.images.length > 0` 时传入，支持 URL 和 data URI。若输入是裸 base64，使用 `buildDataUri()` 包装。
- `official_fallback`：首版不暴露，默认不传或 `false`。

不传字段：

- `response_format`：ApiMart 文档说明任务结果只返回 URL，首版不传给上游。
- `quality` / `style`：文档说明不支持或会被忽略，首版不传给上游。

### 任务轮询

提交：

- `POST ${apiUrl}/images/generations`。
- header：`Authorization: Bearer ${apiKey}`、`Content-Type: application/json`。
- 成功后从 `data[0].task_id` 读取任务 ID。

轮询：

- `GET ${apiUrl}/tasks/${taskId}`。
- 初始等待可设为 10 秒，后续每 3 秒轮询，整体受 `options.timeoutMs` 或配置超时约束。
- 状态：
  - `completed`：读取 `data.result.images[0].url[0]`，可兼容多图片结构。
  - `failed` / `cancelled`：抛出包含上游错误信息的异常。
  - `submitted` / `processing`：继续轮询。
  - 未知状态：记录日志并继续到超时，或在连续异常后失败。

### 响应映射

- 默认返回 `ImageData` URL。
- 若 `options.returnBase64` 或请求要求 `b64_json`，复用 `urlToBase64()` 转换。
- `GenerationResult.provider = "ApiMart"`，`model = "gpt-image-2"`。

## 前端边界

### 元数据

`web/js/modules/utils.js` 增加：

- `providerMeta.ApiMart`，图标使用现有 Remix Icon，例如 `ri-store-2-line` 或 `ri-image-ai-line`。
- `detectApiKey()` 对 ApiMart 默认返回 `false` 或仅识别明确前缀。首版不把普通 `sk-` 判定为 ApiMart。

### 仪表盘

`web/js/modules/admin.js` 在 configured 判断中增加 `ApiMart`：

- `config.apimartConfigured || detectApiKey(config.globalAccessKey, "ApiMart")`。
- 若按默认决策不做裸 Key 自动识别，则主要依赖 `config.apimartConfigured`。

### 渠道设置

`web/js/modules/channel.js`：

- 增加 `APIMART_SIZES`，使用文档支持的比例：
  - `auto`、`1:1`、`3:2`、`2:3`、`4:3`、`3:4`、`5:4`、`4:5`、`16:9`、`9:16`、`2:1`、`1:2`、`3:1`、`1:3`、`21:9`、`9:21`。
- `buildSizeSelect()` 对 `provider.name === "ApiMart"` 使用该列表。
- 如实现 `resolution` UI，新增 `buildResolutionSelect()` 或在 ApiMart 卡片中增加一个仅 ApiMart 可见字段，保存为 `data-field="resolution"`。
- 保存逻辑已按 `data-provider` / `data-task` / `data-field` 动态写入，若 `ProviderTaskDefaults` 支持 `resolution`，可以复用现有 `providersUpdate` 结构。

### Key 池

`web/js/modules/keys.js`：

- Provider 列表来自 `/api/config`，新增 Provider 后自动出现。
- 添加/编辑 Key 时，ApiMart 不需要 `NewApi` 特殊字段。
- Key 格式验证对 `ApiMart` 跳过或宽松处理，避免因为通用 `sk-` 阻塞用户添加。

## 管理 API

`src/app.ts` 的 `/api/config`：

- Provider 列表会从 registry 自动生成，但需要增加 `apimartConfigured`。
- 如果实现 `resolution`，可继续通过 `runtimeConfig` 下发，无需新增接口。

Key 池 API 已按 provider 字符串工作，不需要新增专用接口。

## 兼容性与迁移

- 不覆盖现有 `data/runtime-config.json`。默认配置只作为缺省值；已有运行时配置没有 `ApiMart` 时，前端仍应能从 `/api/config` Provider 列表看到 Provider，保存后写入 `providers.ApiMart`。
- `sanitizeRuntimeConfig()` 必须允许新增的 `resolution` 字段，否则保存后会被清理。
- 中转模式自动 Key 识别不应扩大到通用 `sk-`，以免破坏现有路由。

## 风险与处理

- 风险：ApiMart 任务结果结构变体可能不止 `data.result.images[0].url[0]`。
  - 处理：结果解析兼容数组 URL 和字符串 URL，错误时输出包含 task ID 的清晰错误。
- 风险：`resolution` 是新 task default 字段，可能影响 sanitizer。
  - 处理：先补类型和 sanitizer，再补 UI。
- 风险：真实 ApiMart Key 不可用导致无法端到端生图验证。
  - 处理：完成本地类型检查、lint、配置保存和 UI 验证；真实调用只在用户提供 Key 后声明通过。

## 回滚形态

本任务应是集中新增 Provider 的原子变更。若需要回滚，可回退以下文件组：

- `src/providers/apimart.ts`
- `src/providers/base.ts`
- `src/types/provider.ts`
- `src/providers/registry.ts`
- `src/config/manager.ts`
- `src/app.ts`
- `web/js/modules/utils.js`
- `web/js/modules/admin.js`
- `web/js/modules/channel.js`
- `web/js/modules/keys.js`
- README 或相关文档
