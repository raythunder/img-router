# 数据与持久化规范

> 当前项目没有数据库、ORM 或迁移系统。持久化主要通过 `data/runtime-config.json`、`data/storage/`
> 图片文件、配套 JSON 元数据，以及可选 S3/R2 对象存储完成。

---

## 总览

不要为普通配置、Key 池或图片画廊引入数据库抽象。现有实现以文件为事实来源：

- 运行时配置：`src/config/manager.ts` 读取和写入 `data/runtime-config.json`
- Key 池：`runtimeConfig.keyPools` 存在同一个运行时配置文件中
- 图片画廊：`src/core/storage.ts` 写入 `data/storage/<image>` 和 `data/storage/<image>.json`
- 可选对象存储：`StorageService` 根据 `runtimeConfig.storage.s3` 同步图片和元数据

---

## 读写模式

运行时配置必须通过 `configManager` 及导出的 helper 操作，例如
`getRuntimeConfig()`、`replaceRuntimeConfig()`、`setProviderTaskDefaults()`、`setProviderEnabled()`。这些方法会负责保存到磁盘并同步
Provider 启用状态。

图片保存应走 `storageService.saveImage()`，不要在 handler 中直接拼接 `data/storage`
文件名。该服务已经处理 base64 清洗、WebP 转 PNG、元数据写入、S3 同步和日志。

Key 状态变更应走 `keyManager.markKeyExhausted()` 或 `keyManager.markKeyInvalid()`，不要在 provider
内部手写 `runtime-config.json`。

---

## 配置变更

配置优先级是：环境变量 > `data/runtime-config.json` > `DEFAULT_CONFIG`。新增配置必须在
`src/config/manager.ts` 同步更新：

1. TypeScript interface。
2. `DEFAULT_CONFIG` 或 `DEFAULT_RUNTIME_CONFIG`。
3. `applyRuntimeOverrides()` 或对应 getter/helper。
4. 前端管理页需要展示时，再补 `web/js/modules/*`。

避免只改前端表单或只改默认配置导致运行时配置无法生效。

---

## 命名约定

- 运行时 provider
  键使用现有展示名：`Doubao`、`Gitee`、`ModelScope`、`HuggingFace`、`Pollinations`、`NewApi`、`ApiMart`。
- 静态配置 provider
  键使用小写：`doubao`、`gitee`、`modelscope`、`huggingface`、`pollinations`、`newapi`、`apimart`。
- 任务默认配置使用 `text`、`edit`、`blend` 三类。
- 图片元数据字段保持 `prompt`、`model`、`seed`、`params`、`timestamp`。

## 场景：新增 ApiMart Provider 配置

### 1. Scope / Trigger

- Trigger：新增 `ApiMart` 渠道会同时影响
  `src/config/manager.ts`、`src/providers/*`、`/api/config`、前端渠道设置和 Key
  池管理，是跨层配置契约变更。
- Scope：ApiMart 首版固定使用 `https://api.apimart.ai/v1` 和 `gpt-image-2`，不新增自定义 `baseUrl`
  或模型发现。

### 2. Signatures

- 静态配置：`AppConfig.providers.apimart: BaseProviderConfig`、`ApiKeysConfig.apimart: string`。
- 运行时配置：`runtimeConfig.providers.ApiMart.{text|edit|blend}: ProviderTaskDefaults`。
- Key 池：`runtimeConfig.keyPools.ApiMart: KeyPoolItem[]`。
- Provider：`ApiMartProvider.name === "ApiMart"`，注册到 `src/providers/registry.ts`。

### 3. Contracts

- `ProviderTaskDefaults.resolution` 是可选字符串或 `null`，ApiMart 允许值为 `1k`、`2k`、`4k`。
- ApiMart 文生图、图生图、融合生图都提交到 `/images/generations`；图生图和融合生图通过 `image_urls`
  传 URL 或 data URI。
- 单次 ApiMart 上游请求固定 `n: 1`，多张输出继续由 `BaseProvider.generateWithConcurrency()`
  并发模拟。
- ApiMart Key 不做裸 Key 自动识别，避免通用 `sk-` 与 `NewApi` / `Pollinations`
  冲突；后端模式必须通过 `keyPools.ApiMart` 配置。

### 4. Validation & Error Matrix

- `resolution` 不在 `1k|2k|4k` 中 -> 忽略请求值，回退到任务默认值或 `1k`。
- 提交响应缺少 `task_id` -> 抛出 `ApiMart 任务提交失败：未返回 task_id`。
- 轮询状态为 `failed` 或 `cancelled` -> 抛出 `ApiMart Task <status>`，不得静默成功。
- 轮询超时 -> 抛出 `ApiMart Task Timeout`。
- `completed` 但没有图片 URL -> 抛出 `ApiMart Task Completed but no image URL returned`。

### 5. Good/Base/Bad Cases

- Good：`providers.ApiMart.text.resolution = "2k"`，Provider 提交体包含 `resolution: "2k"`。
- Base：未配置 `resolution`，Provider 使用默认 `1k`。
- Bad：在 ApiMart Key 形态不稳定时把 `detectApiKey()` 写成匹配 `sk-`，会抢走 `NewApi` 或
  `Pollinations` 请求。

### 6. Tests Required

- `deno check src/main.ts` 必须通过，确认类型契约完整。
- `deno lint` 必须通过，确认新增 Provider 没有未使用导入或错误异步写法。
- 本地服务 `/api/config` 必须包含 `ApiMart`，且 `runtimeConfig.providers.ApiMart` 和
  `keyPools.ApiMart` 可见。
- 无真实 ApiMart Key 时，只能验证配置、路由暴露和管理端保存；不得声称真实生图已通过。

### 7. Wrong vs Correct

#### Wrong

```ts
// 不要把 ApiMart 当成 ModelScope 或 NewApi 的一个分支
if (provider === "ModelScope" && apiUrl.includes("apimart")) {
  // handler 或旧 provider 内散落 ApiMart 协议
}
```

#### Correct

```ts
// ApiMart 是独立 Provider；handler 只通过 registry 调度
providerRegistry.register(apiMartProvider);
```

---

## 常见错误

- 不要新增数据库迁移文件；当前仓库没有迁移执行链路。
- 不要覆盖用户已有 `data/runtime-config.json`。`ConfigManager`
  的失败回退策略是返回空配置，避免覆盖用户数据。
- 不要把密钥写进 README、spec 或默认模板；`DEFAULT_RUNTIME_CONFIG.system.globalAccessKey`
  已明确移除敏感 key。
- 不要直接删除 `data/storage` 文件；画廊删除应走 `/api/gallery` 或
  `storageService.deleteImages()`，以便同步元数据和 S3。
