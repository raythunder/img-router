# Add ApiMart Channel Settings - Implement Plan

## 执行前检查

- [ ] 用户确认按当前 PRD / Design 开始实现。
- [ ] 执行 `python3 ./.trellis/scripts/task.py start 06-04-add-apimart-channel-settings`，将任务状态切到 `in_progress`。
- [ ] 读取 `trellis-before-dev` 技能和相关 spec：
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/frontend/index.md`
  - 后端 Provider、配置、错误处理、日志规范
  - 前端目录、状态管理、组件和质量规范

## 实施步骤

1. 后端类型和配置
   - [ ] 在 `src/providers/base.ts`、`src/types/provider.ts` 增加 `ApiMart` 类型。
   - [ ] 在 `src/config/manager.ts` 增加 `apimart` 静态配置、运行时默认配置、Key 池默认值和模型导出。
   - [ ] 如实现 `resolution`，扩展 `ProviderTaskDefaults`、sanitizer 白名单和保存兼容。

2. 新增 Provider
   - [ ] 创建 `src/providers/apimart.ts`。
   - [ ] 实现 `ApiMartProvider.generate()`：区分文生图和图生图，但统一走 `/images/generations`。
   - [ ] 实现 `blend()`：复用消息中的 prompt 与图片提取逻辑，转换为标准生成请求。
   - [ ] 实现提交任务和轮询任务的私有方法。
   - [ ] 实现任务结果 URL 提取和 `b64_json` 转换。
   - [ ] 明确 `failed`、`cancelled`、超时和异常响应错误。

3. Provider 注册和配置 API
   - [ ] 在 `src/providers/registry.ts` 注册 `apiMartProvider`。
   - [ ] 在 `src/app.ts` 的 `/api/config` 增加 `apimartConfigured`。
   - [ ] 检查 `/v1/models` 或模型映射路径是否需要把 `ApiMart` 纳入模型列表。

4. 前端渠道设置
   - [ ] `web/js/modules/utils.js` 增加 `providerMeta.ApiMart`。
   - [ ] `web/js/modules/admin.js` 增加 `ApiMart` configured 状态判断。
   - [ ] `web/js/modules/channel.js` 增加 ApiMart 尺寸列表。
   - [ ] 如实现 `resolution` UI，增加 ApiMart 专属 `resolution` 下拉，并复用现有保存结构。

5. 前端 Key 池管理
   - [ ] 确认 `ApiMart` 自动出现在 Provider 列表。
   - [ ] 对 `ApiMart` Key 添加/编辑采用普通 Key 流程。
   - [ ] 跳过严格裸 Key 格式验证，避免 `sk-` 冲突。

6. 文档同步
   - [ ] README Provider 列表增加 `ApiMart`。
   - [ ] README Key 自动识别规则说明 ApiMart 默认通过后端 Key 池配置。
   - [ ] README 渠道数据流补充 ApiMart 异步任务模式。
   - [ ] 如新增 `resolution`，补充运行时配置说明。

## 验证计划

- [ ] `deno check src/main.ts`
- [ ] `deno lint`
- [ ] 启动本地服务：`deno task start`
- [ ] 验证健康检查：`curl http://localhost:10001/health`
- [ ] 浏览器验证：
  - [ ] `http://localhost:10001/admin` 能看到 `ApiMart` 渠道状态。
  - [ ] `http://localhost:10001/channel` 能看到并保存 `ApiMart` 渠道配置。
  - [ ] `http://localhost:10001/keys` 能选择 `ApiMart` 并添加/编辑 Key。
- [ ] 如果没有真实 ApiMart Key，只报告配置/UI/静态协议验证通过，不声称真实生图成功。
- [ ] 如果用户提供真实 ApiMart Key，再补真实 `/v1/images/generations` 文生图或图生图验证。

## 重点文件与回滚点

- 后端 Provider：`src/providers/apimart.ts`
- Provider 类型：`src/providers/base.ts`、`src/types/provider.ts`
- Provider 注册：`src/providers/registry.ts`
- 配置：`src/config/manager.ts`
- 管理 API：`src/app.ts`
- 前端元数据和页面：`web/js/modules/utils.js`、`web/js/modules/admin.js`、`web/js/modules/channel.js`、`web/js/modules/keys.js`
- 文档：`README.md`

若实施中发现 ApiMart 文档契约与当前设计冲突，先暂停实现，更新 `prd.md` / `design.md` 后再继续。
