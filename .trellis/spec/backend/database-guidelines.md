# 数据与持久化规范

> 当前项目没有数据库、ORM 或迁移系统。持久化主要通过 `data/runtime-config.json`、`data/storage/` 图片文件、配套 JSON 元数据，以及可选 S3/R2 对象存储完成。

---

## 总览

不要为普通配置、Key 池或图片画廊引入数据库抽象。现有实现以文件为事实来源：

- 运行时配置：`src/config/manager.ts` 读取和写入 `data/runtime-config.json`
- Key 池：`runtimeConfig.keyPools` 存在同一个运行时配置文件中
- 图片画廊：`src/core/storage.ts` 写入 `data/storage/<image>` 和 `data/storage/<image>.json`
- 可选对象存储：`StorageService` 根据 `runtimeConfig.storage.s3` 同步图片和元数据

---

## 读写模式

运行时配置必须通过 `configManager` 及导出的 helper 操作，例如 `getRuntimeConfig()`、`replaceRuntimeConfig()`、`setProviderTaskDefaults()`、`setProviderEnabled()`。这些方法会负责保存到磁盘并同步 Provider 启用状态。

图片保存应走 `storageService.saveImage()`，不要在 handler 中直接拼接 `data/storage` 文件名。该服务已经处理 base64 清洗、WebP 转 PNG、元数据写入、S3 同步和日志。

Key 状态变更应走 `keyManager.markKeyExhausted()` 或 `keyManager.markKeyInvalid()`，不要在 provider 内部手写 `runtime-config.json`。

---

## 配置变更

配置优先级是：环境变量 > `data/runtime-config.json` > `DEFAULT_CONFIG`。新增配置必须在 `src/config/manager.ts` 同步更新：

1. TypeScript interface。
2. `DEFAULT_CONFIG` 或 `DEFAULT_RUNTIME_CONFIG`。
3. `applyRuntimeOverrides()` 或对应 getter/helper。
4. 前端管理页需要展示时，再补 `web/js/modules/*`。

避免只改前端表单或只改默认配置导致运行时配置无法生效。

---

## 命名约定

- 运行时 provider 键使用现有展示名：`Doubao`、`Gitee`、`ModelScope`、`HuggingFace`、`Pollinations`、`NewApi`。
- 静态配置 provider 键使用小写：`doubao`、`gitee`、`modelscope`。
- 任务默认配置使用 `text`、`edit`、`blend` 三类。
- 图片元数据字段保持 `prompt`、`model`、`seed`、`params`、`timestamp`。

---

## 常见错误

- 不要新增数据库迁移文件；当前仓库没有迁移执行链路。
- 不要覆盖用户已有 `data/runtime-config.json`。`ConfigManager` 的失败回退策略是返回空配置，避免覆盖用户数据。
- 不要把密钥写进 README、spec 或默认模板；`DEFAULT_RUNTIME_CONFIG.system.globalAccessKey` 已明确移除敏感 key。
- 不要直接删除 `data/storage` 文件；画廊删除应走 `/api/gallery` 或 `storageService.deleteImages()`，以便同步元数据和 S3。
