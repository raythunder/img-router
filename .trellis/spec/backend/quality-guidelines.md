# 后端质量规范

> 代码质量以 Deno 原生工具、清晰分层、Provider 协议隔离和可验证行为为准。

---

## 总览

项目启用 `deno.json` 的 `strict` TypeScript、`deno lint` recommended 规则和 Deno formatter。当前仓库没有测试目录；改动时至少运行与变更匹配的 `deno check` / `deno lint`，涉及服务启动时再验证 `/health` 或目标接口。

---

## 禁止模式

- 不要在 handler 里直接调用新的上游图片 API；上游协议必须封装在 provider。
- 不要新增未声明依赖。依赖必须先加入 `deno.json` imports 或明确使用 Deno/Node 标准兼容 API。
- 不要绕过 `fetchWithTimeout()` 进行上游 HTTP 请求，除非有明确原因并同步记录。
- 不要直接写入 `data/runtime-config.json`；使用 `configManager` helper。
- 不要把大功能塞进 `src/app.ts` 的路由函数；业务端点应拆到 handler 或 core。
- 不要引入数据库、构建工具或前端框架来解决局部问题。

---

## 必须模式

- Provider 必须声明 `capabilities`，并让 `BaseProvider.validateRequest()` 能正确判断输入图片数量和能力支持。
- 多图生成要尊重 `maxNativeOutputImages`，通过 `generateWithConcurrency()` 拆分时注意上游限流。
- 安全相关 URL 下载/上传要复用 `src/utils/security.ts` 和 `src/utils/image.ts` 中既有能力。
- 响应格式保持 OpenAI 兼容：`created` + `data: [{ url } | { b64_json }]`。
- 管理端配置变更必须同步运行时配置并避免覆盖用户数据。

---

## 验证要求

常用验证命令：

```bash
deno check src/main.ts
deno lint
deno fmt --check
deno task start
curl -sS http://localhost:10001/health
```

当前 `deno fmt --check` 可能暴露既有格式差异；不要在无关任务中大面积格式化。若只改 `.trellis/spec`，可以用占位符 grep 和 Trellis validate 作为主要验证。

---

## Code Review Checklist

- 分层是否正确：handler/core/provider/utils 是否各司其职。
- 是否保持 KISS/YAGNI：没有为单个 provider 引入通用复杂框架。
- 配置和文档是否同步：新增字段是否覆盖默认配置、运行时配置、管理端和 README/spec。
- 是否保护密钥和用户数据：无明文 key、无覆盖 runtime-config、无危险删除。
- 是否有真实验证：静态检查、接口 smoke 或浏览器验证与改动风险匹配。
