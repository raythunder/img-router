# 错误处理规范

> 错误处理以简单 JSON 响应、模块化日志和上游错误归类为主。不要引入复杂异常层次，除非现有 `ErrorType` 无法表达。

---

## 总览

外层请求由 `withLogging()` 捕获未处理异常，并返回：

```json
{
  "error": {
    "message": "错误信息",
    "type": "server_error"
  }
}
```

具体 handler 也会在本地 `try/catch` 中记录日志并返回同类结构。上游 Provider 错误应在 provider 内部尽量转换成可读消息，再抛给 handler。

---

## 错误类型

`src/core/error-handler.ts` 定义了现有错误分类：

- `moderation_blocked`
- `bad_request`
- `internal_error`
- `timeout`
- `no_available_key`
- `rate_limit`
- `unknown`

Provider 调上游时优先使用 `parseErrorMessage(errorText, status, provider)`，不要把上游原始大段 JSON 直接暴露给客户端。

---

## 处理模式

请求参数错误应尽早返回 `400` 或业务错误，例如缺少鉴权、模式关闭、无可用 provider、请求体字段不合法。Provider 执行失败时抛 `Error`，由 handler 决定是否继续下一个 Provider 或返回 `500`。

异步上游任务需要在 provider 内部完成状态轮询和状态转换。示例：`src/providers/modelscope.ts` 在提交失败时解析 HTTP 错误，轮询失败时抛 `ModelScope Task Failed` 或 timeout。

多 Provider 级联场景保留 `lastError`，所有 Provider 都失败后再抛出最后一个错误，见 `src/handlers/images.ts`。

---

## API 错误响应

保持响应格式稳定：

- 鉴权失败：`{ "error": "Unauthorized" }`，状态码 `401`
- 服务模式关闭：`{ "error": "服务未启动：请开启中转模式或后端模式" }`，状态码 `503`
- 通用失败：`{ "error": { "message": "...", "type": "server_error" } }`
- 管理 API 可使用简单 `{ error: String(e) }`，但必须带 `Content-Type: application/json`

新增端点不要返回 HTML 错误页。

---

## 常见错误

- 不要吞掉异常后返回成功空数组；图片生成失败需要明确错误。
- 不要在 provider 中记录完整 API Key。日志里如果需要定位 key，只能记录后 4 位或前缀。
- 不要把静态资源 404 当成业务错误刷日志；中间件已有静态资源过滤策略。
- 不要把上游状态结构假设成通用格式。不同 provider 的 `task_id`、状态字段和图片路径都应在各自 provider 内解析。
