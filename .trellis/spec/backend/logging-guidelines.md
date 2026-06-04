# 日志规范

> 项目使用自研轻量日志模块 `src/core/logger.ts`，同时输出控制台、`data/logs/YYYY-MM-DD.log` 和 `/api/logs/stream` SSE。

---

## 总览

日志调用统一从 `src/core/logger.ts` 导入 `debug()`、`info()`、`error()` 及专用 helper。日志格式为 `[HH:mm:ss.xx] [LEVEL] [Module] message`，时间使用北京时间。

不要直接使用 `console.log` 写后端业务日志。例外：日志系统自身初始化失败时可降级到 `console.error`。

---

## 日志级别

- `DEBUG`：普通请求、路由判断、请求头脱敏调试、耗时开始/结束。
- `INFO`：启动信息、Provider 选择、图片生成开始/完成、配置迁移、Key 状态变化、存储成功。
- `ERROR`：HTTP 状态码 >= 400、上游失败、保存失败、配置保存失败、无效 Key。

当前没有 `warn` 级别；不要新增临时字符串级别。

---

## 结构和上下文

业务日志第一个参数必须是稳定模块名，例如 `Startup`、`HTTP`、`Router`、`ModelScope`、`Storage`、`KeyManager`。请求链路中优先携带 `requestId`，由 `generateRequestId()` 生成，Provider 日志应写成 `[${requestId}] ...`。

外部 API 调用使用 `withApiTiming(provider, apiType, fn)` 包裹，以便统一记录成功/失败耗时。

---

## 应记录内容

- 服务启动端口、版本、启用 Provider 摘要。
- Provider 路由计划、模型映射和级联失败。
- 上游任务提交 ID、轮询状态摘要、最终图片数量和耗时。
- 管理端配置保存、Key 池变更、运行时配置迁移。
- 图片保存、本地删除、S3 同步。

---

## 禁止记录内容

- 完整 `Authorization`、API Key、Cookie、token。
- 用户上传图片的完整 base64。
- 过长 prompt 的完整内容，除非现有 `logFullPrompt()` 语义明确需要；新增日志应优先截断。
- 高频轮询的每次成功请求。`/api/logs/stream` 和静态资源已有过滤，新增轮询端点也应避免刷屏。
