# 前端逻辑复用规范

> 项目不使用 React hooks 或 Vue composables。这里的“hook”对应可复用函数、事件委托、模块级状态和路由清理函数。

---

## 总览

共享逻辑放在 `web/js/modules/utils.js` 或页面内私有函数。只有两个以上页面复用时才提升到 `utils.js`，避免过早抽象。

现有共享函数包括：

- `apiFetch()`：附加本地 `authToken` 后请求后端。
- `detectApiKey()`：前端初步判断 Provider Key 格式。
- `debounce()`：表单自动保存防抖。
- `escapeHtml()`：模板插值转义。

---

## 事件模式

复杂页面优先使用事件委托，在 `container` 上监听 `change` / `click`，通过 `e.target.dataset` 或 `closest()` 判断操作。`channel.js` 是主要示例。

全局事件、定时器、SSE 或 lightbox 键盘事件必须提供清理路径，并在路由切换时通过 `container.cleanup` 释放。

---

## 数据请求

请求后端 API 使用 `apiFetch()`，不要直接散落 `fetch()`，除非是明确的外部资源下载。请求失败应在页面内展示错误或 fallback，不应让路由整体崩溃；`router.js` 只做最后兜底。

配置类页面一般流程是：

1. 渲染 loading。
2. 调 API 加载配置。
3. 更新模块级缓存。
4. 重新渲染表单。
5. 用户修改后防抖保存。

---

## 命名约定

不使用 `use*` 命名，避免暗示 React hook。普通函数按动作命名：`loadChannelConfig()`、`updateModelScopeSizeOptions()`、`showModelMapEditor()`。

防抖保存函数可命名为 `debounceSave` 或 `saveConfigDebounced`，保持页面内一致即可。

---

## 常见错误

- 不要为单页私有逻辑创建全局 helper。
- 不要在路由切换后保留旧页面定时器或事件监听。
- 不要跳过 `apiFetch()` 导致管理端鉴权 token 丢失。
- 不要把临时 UI 状态塞入 `store`，除非确实跨页面共享。
