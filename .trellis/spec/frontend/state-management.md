# 状态管理规范

> 前端状态管理是一个轻量发布订阅 store + 页面模块级变量 + 后端运行时配置。没有 Redux、Pinia、React
> Query 等库。

---

## 总览

`web/js/modules/store.js` 只缓存全局系统配置、加载状态和错误。多数页面状态保留在页面模块内部，例如
`channel.js` 的 `currentConfig`、`channelSupportedSizes`、`channelRuntimeConfig`。

后端 `data/runtime-config.json` 才是配置事实来源；前端缓存只是展示和编辑副本。

---

## 状态分类

- 全局配置状态：`store.state.config`，通过 `/api/config` 加载。
- 页面 UI 状态：模块级变量或 DOM 状态，例如当前 modal、选中的 provider、表单字段。
- 服务端状态：运行时配置、Key 池、画廊列表、日志流，由后端 API 提供。
- URL 状态：当前页面路径由 `router.js` 管理，根路径重定向到 `/admin`。
- 管理登录状态：由后端 HttpOnly Cookie 和 `/api/admin/session` 提供，前端不读取 Cookie 内容。

---

## 何时使用全局状态

只有多个页面都需要读取并且刷新成本高的状态才放进 `store`。单页表单、modal、筛选条件和 loading
文案保留在页面模块内。

不要为了“统一”把所有 API 响应都塞进 `store`；这会让页面行为变得隐式。

---

## 服务端同步

配置编辑页应从后端加载最新配置，用户修改后调用对应 API
保存。保存成功后必要时重新加载配置，保证前端缓存与 `runtime-config.json` 一致。

自动保存场景必须使用 `debounce()`，避免每次输入都写磁盘。Provider 启用状态、模型、尺寸和 n
等字段都应保留在 `providers.{Provider}.{task}` 结构中。

---

## 常见错误

- 不要把 `localStorage.authToken` 当成全局状态同步系统；它只用于 `apiFetch()` 附加鉴权头。
- 不要把管理端用户名、密码或 session token 写入 `localStorage`；管理登录态必须依赖后端 Cookie。
- `apiFetch()` 遇到管理 API 的 `401` 时负责跳转 `/login`，页面模块不要重复写跳转逻辑。
- 不要依赖页面模块变量跨路由保留；路由切换会清空 `main-container`，页面应能重新加载。
- 不要直接修改 `store.state` 后忘记 `notify()`；使用现有 `loadConfig()` 模式。
- 不要在前端构造与后端不一致的 provider/task 键名。
