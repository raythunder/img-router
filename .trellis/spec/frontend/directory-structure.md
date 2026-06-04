# 前端目录结构

> 管理端是原生 HTML/CSS/JavaScript SPA，不使用 React、Vue、构建器或组件库。Deno 后端直接读取 `web/index.html`、`web/css/*`、`web/js/*` 提供页面。

---

## 总览

前端入口是 `web/index.html` 和 `web/js/main.js`。路由由 `web/js/modules/router.js` 基于 History API 实现，每个页面模块导出一个 `renderX(container)` 函数，直接把 HTML 写入 `#main-container` 并绑定事件。

不要新增框架、打包配置或 JSX。新增页面应沿用现有 ES module 模式。

---

## 目录布局

```text
web/
├── index.html              # 固定外壳：sidebar、header、main-container、modal-container
├── css/
│   ├── style.css           # 主界面样式和通用控件
│   └── gallery.css         # 画廊专用样式
└── js/
    ├── main.js             # 初始化 router
    └── modules/
        ├── router.js       # SPA 路由和页面清理
        ├── store.js        # 轻量全局配置状态
        ├── utils.js        # apiFetch、detectApiKey、debounce、escapeHtml
        ├── admin.js        # 仪表盘
        ├── setting.js      # 系统设置
        ├── channel.js      # Provider 渠道设置
        ├── keys.js         # Key 池管理
        ├── key-manager.js  # Key 相关辅助 UI
        ├── gallery.js      # 图片画廊
        ├── prompt-optimizer.js
        └── update.js
```

---

## 模块组织

页面模块应只暴露渲染入口，例如 `renderChannel(container)`。页面内部辅助函数保持文件私有，除非多个页面复用，再放到 `utils.js`。

跨页面状态目前只放系统配置和加载状态，见 `store.js`。页面自身表单状态、当前配置缓存和临时数组保留在模块级变量中，例如 `channel.js` 的 `currentConfig`、`channelRuntimeConfig`。

新增路由需要同时更新：

1. `web/index.html` 侧边栏导航。
2. `web/js/modules/router.js` 的 `routes`。
3. `src/app.ts` 的 `spaRoutes`，否则刷新页面会 404。

---

## 命名约定

- 前端文件使用 kebab-case 或现有短名：`prompt-optimizer.js`、`key-manager.js`、`gallery.js`。
- 页面渲染函数使用 `renderX`：`renderAdmin`、`renderSetting`、`renderGallery`。
- DOM id 和 class 沿用现有语义：`main-container`、`modal-container`、`nav-item`、`card`、`status-pill`。
- Provider 展示名必须与后端一致：`ModelScope` 不能写成 `modelscope`。

---

## 真实示例

- `web/js/modules/router.js`：路由注册、导航拦截、页面清理和错误兜底。
- `web/js/modules/channel.js`：复杂表单页面，展示事件委托、防抖保存和动态尺寸选项。
- `web/js/modules/store.js`：最小发布订阅状态。
- `web/js/modules/utils.js`：共享 API 请求、Key 格式检测、HTML 转义。
