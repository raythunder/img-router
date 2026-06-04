# 后端目录结构

> 本项目是 Deno + TypeScript 单仓服务。后端代码位于 `src/`，负责 OpenAI 兼容图片 API、Provider
> 路由、运行时配置、日志、存储和管理 API。

---

## 总览

后端采用“入口 -> 路由 -> handler -> provider/core”的直接结构，不使用 Web 框架。`src/main.ts`
负责初始化和 `Deno.serve`，`src/app.ts` 负责 HTTP 路由、静态资源和管理 API，具体业务端点拆到
`src/handlers/`。

新增能力时优先放进既有层次，避免创建新的框架式目录：

- HTTP 路由和管理接口：`src/app.ts`
- OpenAI 兼容业务端点：`src/handlers/*.ts`
- 上游图片服务适配：`src/providers/*.ts`
- 可复用服务：`src/core/*.ts`
- 请求、图片、安全等工具：`src/utils/*.ts`
- 共享类型：`src/types/*.ts`

---

## 目录布局

```text
src/
├── main.ts                  # 初始化日志、同步 provider 状态、启动 Deno.serve
├── app.ts                   # 路由、静态资源、管理 API、SSE 日志流
├── config/
│   └── manager.ts           # 默认配置、runtime-config、环境变量覆盖和配置 getter
├── core/
│   ├── error-handler.ts     # 上游错误文本归类和友好错误提示
│   ├── key-manager.ts       # Key 池轮询、限流/失效标记
│   ├── logger.ts            # 控制台、文件、SSE 日志
│   ├── prompt-optimizer.ts  # 提示词翻译/扩充
│   ├── router.ts            # 权重路由和模型匹配
│   └── storage.ts           # 本地图片/元数据存储和可选 S3 同步
├── handlers/
│   ├── chat.ts              # /v1/chat/completions
│   ├── images.ts            # /v1/images/generations
│   ├── edits.ts             # /v1/images/edits
│   └── blend.ts             # /v1/images/blend
├── middleware/
│   ├── logging.ts           # requestId、请求日志和统一兜底错误响应
│   └── timing.ts            # 上游 API 耗时统计
├── providers/
│   ├── base.ts              # IProvider、BaseProvider、通用参数选择和并发拆分
│   ├── registry.ts          # Provider 注册、启停和 API Key 自动识别
│   └── *.ts                 # Doubao/Gitee/ModelScope/HuggingFace/Pollinations/NewApi/ApiMart 适配
├── types/
│   ├── request.ts           # OpenAI 兼容请求/响应类型
│   └── provider.ts          # Provider 相关类型
└── utils/
    ├── http.ts              # fetchWithTimeout 等 HTTP 工具
    ├── image.ts             # base64/URL/压缩/WebP 转换
    └── security.ts          # URL 安全和 SSRF 防护
```

---

## 模块组织

Provider 新增或修改时应围绕 `src/providers/base.ts` 的 `IProvider` / `BaseProvider` 扩展：声明
`name`、`capabilities`、`config`、`detectApiKey()` 和 `generate()`，再在 `src/providers/registry.ts`
注册单例。不要在 handler 中直接写上游 API 细节。

Handler 只负责请求解析、鉴权模式选择、PromptOptimizer 调用、Provider
调度、响应组装和本地存储触发。上游协议转换属于 provider，例如 `src/providers/modelscope.ts`
处理异步提交和轮询，`src/providers/newapi.ts` 处理 OpenAI 兼容网关。

配置字段先在 `src/config/manager.ts` 的接口、默认配置、runtime 覆盖和 getter 中补齐，再由
provider/core 使用。不要在业务文件里散落硬编码配置。

---

## 命名约定

- TypeScript 后端文件使用 kebab-case：`key-manager.ts`、`error-handler.ts`、`prompt-optimizer.ts`。
- Provider 类使用 PascalCase，导出单例使用 camelCase：`ModelScopeProvider` / `modelScopeProvider`。
- Provider
  名称字符串保持现有精确值：`Doubao`、`Gitee`、`ModelScope`、`HuggingFace`、`Pollinations`、`NewApi`、`ApiMart`。
- API 路径保持 OpenAI
  兼容命名：`/v1/images/generations`、`/v1/images/edits`、`/v1/chat/completions`。

---

## 真实示例

- `src/providers/modelscope.ts`：异步任务 Provider
  的完整例子，包含提交任务、轮询、状态兼容和输出图片提取。
- `src/providers/newapi.ts`：OpenAI 兼容网关 Provider 例子，支持 Key 组按模型路由。
- `src/providers/apimart.ts`：ApiMart `gpt-image-2` 异步任务 Provider，独立处理
  `/images/generations` 提交、`/tasks/{task_id}` 轮询、`image_urls` 输入和 `resolution` 参数。
- `src/handlers/images.ts`：文生图
  handler，展示后端模式/中转模式、权重计划、PromptOptimizer、多图拆分和响应格式转换。
- `src/core/storage.ts`：文件系统 + 可选 S3 的持久化服务单例。
