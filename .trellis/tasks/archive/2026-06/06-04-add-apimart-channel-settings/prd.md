# Add ApiMart Channel Settings

## 背景

当前 ImgRouter 已支持 `Doubao`、`Gitee`、`ModelScope`、`HuggingFace`、`Pollinations`、`NewApi`
多个图片 Provider。用户希望新增 ApiMart 渠道设置，使 ApiMart 的 `gpt-image-2`
图像生成能力可以作为独立渠道被配置、启用、管理 Key，并参与现有 OpenAI 兼容图片生成入口。

ApiMart 官方文档地址：`https://docs.apimart.ai/cn/api-reference/images/gpt-image-2/generation`。

## 已确认事实

- 后端采用 Deno + TypeScript，无 Web 框架，Provider 适配集中在 `src/providers/*.ts`。
- 新 Provider 应实现 `src/providers/base.ts` 的 `IProvider` / `BaseProvider`，再在
  `src/providers/registry.ts` 注册。
- 配置事实来源是 `src/config/manager.ts` 和 `data/runtime-config.json`，前端管理页通过 `/api/config`
  获取 Provider 列表和运行时配置。
- 前端管理端是原生 HTML/CSS/JS SPA，不引入构建器或前端框架。
- `ModelScopeProvider` 使用 ModelScope
  原生异步协议：`https://api-inference.modelscope.cn/v1/images/generations` +
  `/tasks/{taskId}`，不等同于 ApiMart 协议。
- ApiMart `gpt-image-2` 文档确认：
  - 提交接口：`POST https://api.apimart.ai/v1/images/generations`。
  - 查询接口：`GET https://api.apimart.ai/v1/tasks/{task_id}`。
  - 鉴权：`Authorization: Bearer <api_key>`。
  - 模型：`gpt-image-2`。
  - 支持文生图和图生图，图生图通过 `image_urls` 传 URL 或 base64 data URI。
  - 支持 `size` 比例和 `resolution`（`1k` / `2k` / `4k`）。
  - 参考图最多 16 张。
  - 返回异步任务 ID，完成后从任务结果中读取图片 URL。

## 目标

新增 `ApiMart` 作为独立可配置图片 Provider，让用户可以在管理端完成以下事情：

- 在“渠道设置”中看到并启用/禁用 `ApiMart`。
- 配置 `ApiMart` 的文生图、图生图、融合生图默认模型、尺寸、生成数量和路由权重。
- 在“Key 池管理”中选择 `ApiMart` 并添加、编辑、启用/禁用 ApiMart API Key。
- 在后端模式下通过 `ApiMart` Key 池调用 `gpt-image-2`。
- 在中转模式下，仅在可安全识别时才自动路由 ApiMart Key；若 ApiMart Key 与通用 `sk-`
  格式冲突，则优先不做裸 Key 自动识别，避免误路由到 `NewApi` 或 `Pollinations`。

## 需求

### 后端需求

- 增加 Provider 名称 `ApiMart`，并同步所有共享 Provider 类型。
- 新增独立 `ApiMartProvider`，不要把 ApiMart 逻辑塞进 `ModelScopeProvider`。
- `ApiMartProvider` 至少支持：
  - 文生图：`prompt` -> `/v1/images/generations`。
  - 图生图：`prompt + images[]` -> `/v1/images/generations` 的 `image_urls`。
  - 融合生图：复用现有 `blend()` 消息图片提取模式，最终走 `image_urls`。
- `ApiMartProvider` 必须封装提交任务、轮询任务、状态转换和结果图片 URL 提取，handler
  不写上游协议细节。
- `n` 对外仍允许通过现有并发拆分模拟多张；单次 ApiMart 上游请求固定按原生限制 `n=1` 发送。
- 支持 `url` 和 `b64_json` 两种对外响应格式；当请求要求 `b64_json` 时，沿用项目现有 URL 转 base64
  工具策略。
- 配置新增必须同步：
  - `AppConfig.providers.apimart`。
  - `ApiKeysConfig.apimart`（如保留静态配置兼容）。
  - `DEFAULT_CONFIG.providers.apimart`。
  - `DEFAULT_RUNTIME_CONFIG.providers.ApiMart`。
  - `DEFAULT_RUNTIME_CONFIG.keyPools.ApiMart`。
  - `/api/config` 中 Provider 列表、configured 状态、模型列表输出。

### 前端需求

- `web/js/modules/utils.js` 增加 `ApiMart` 展示元数据。
- 管理端“仪表盘”的渠道状态能正确显示 `ApiMart` 的启用和缺 Key 状态。
- “渠道设置”页面能渲染 `ApiMart`：
  - 模型默认显示 `gpt-image-2`。
  - 尺寸提供 ApiMart 支持的比例选项。
  - 需要支持 `resolution` 配置，优先用现有 task defaults 扩展；若实现复杂度过高，先以固定默认 `1k`
    落地并在文档标注。
- “Key 池管理”页面能添加/编辑 `ApiMart` Key。
- 不为 ApiMart 复制 NewApi 的 `baseUrl` / `models` 特殊字段；ApiMart 默认固定
  `https://api.apimart.ai` 和 `gpt-image-2`，除非后续明确需要自定义网关。

### 文档需求

- README 的 Provider 列表、Key 规则和渠道数据流需要同步补充 `ApiMart`。
- 如新增运行时字段（例如 `resolution`），需要同步 Trellis spec 或 README 的运行时配置说明。
- 不得在文档、默认配置或测试样例中写入真实 API Key。

## 非目标

- 不接入 ApiMart 的视频、音频、余额或聊天接口。
- 不新增数据库、迁移系统、前端框架或新的构建流程。
- 不实现 ApiMart 自定义 baseUrl / 多模型发现，除非后续用户明确要求。
- 不保证没有真实 ApiMart Key 时可以完成真实生图验收。

## 验收标准

- [ ] `/api/config` 返回的 `providers` 包含 `ApiMart`，且模型、默认尺寸、能力、启用状态完整。
- [ ] 管理端 `/admin` 能显示 `ApiMart` 渠道状态；后端模式下无启用 Key 时显示缺 Key。
- [ ] 管理端 `/channel` 能配置 `ApiMart` 的启用状态、text/edit/blend 默认值和权重，并保存到
      `runtime-config.json`。
- [ ] 管理端 `/keys` 能选择 `ApiMart`，添加、编辑、启用/禁用 Key，并保存到 Key 池。
- [ ] 后端 `ApiMartProvider` 能按 ApiMart 文档提交任务、轮询任务，并把 completed 结果转换成现有
      `GenerationResult`。
- [ ] `failed` / `cancelled` / 超时任务能返回清晰错误，不静默成功。
- [ ] 文生图、图生图和融合生图均通过 Provider 层调用 ApiMart，不在 handler 中散落 ApiMart 协议。
- [ ] `deno check src/main.ts` 通过。
- [ ] `deno lint` 通过，或对既有无关 lint 问题给出明确说明。
- [ ] 本地服务启动后 `/health` 正常；浏览器验证 `/admin`、`/channel`、`/keys` 中 `ApiMart`
      展示和配置保存可用。
- [ ] README 或相关文档已同步更新。

## 产品决策记录

- 默认决策：`ApiMart` 作为独立 Provider，而不是复用 `ModelScopeProvider` 或 `NewApiProvider`。原因是
  ApiMart 的提交响应、任务查询响应、状态枚举和结果路径与 ModelScope / OpenAI
  兼容同步接口都不同，独立 Provider 更符合 SRP。
- 默认决策：ApiMart Key 主要通过后端 Key 池配置，不新增通用 `sk-` 自动识别。原因是 `sk-` 可能与
  `NewApi`、`Pollinations` 现有识别规则冲突，误路由风险高。

## 开放问题

- ApiMart 的 `resolution` 是否必须在首版 UI 中作为独立控件暴露。推荐首版暴露 `1k` / `2k` / `4k`
  下拉；如果实现成本会明显扩大，则先使用默认 `1k` 并保留后续任务。
