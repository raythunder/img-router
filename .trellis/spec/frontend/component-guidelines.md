# 前端组件规范

> 本项目没有框架组件系统。“组件”实际是页面渲染函数、局部 HTML 模板、CSS class 和事件处理函数的组合。

---

## 总览

页面模块接收 `container`，设置 `container.innerHTML`，再绑定事件或加载数据。保持一个页面一个主渲染函数，复杂区域用私有 helper 返回 HTML 字符串或操作 DOM。

不要引入 React/Vue 组件、模板编译器或自定义构建步骤。

---

## 页面结构

推荐结构：

```javascript
import { apiFetch, debounce, escapeHtml } from "./utils.js";

export async function renderSomePage(container) {
  container.innerHTML = `
    <div class="card">
      ...
    </div>
  `;

  container.addEventListener("change", onChange);
  await loadData();
}
```

需要清理定时器或全局事件时，把清理函数挂到 `container.cleanup`，路由切换时 `router.js` 会调用它。

---

## 数据和参数

前端没有 props 类型系统。页面间不要直接互相传对象；通过后端 API、URL 路由或 `store` 共享少量全局配置。DOM 数据使用 `data-*` 属性，例如 `channel.js` 用 `data-provider`、`data-field` 判断配置项。

所有插入 HTML 的用户可控内容必须经过 `escapeHtml()`。当前 `utils.js` 已提供 DOM API 版转义。

---

## 样式模式

样式优先复用 `web/css/style.css` 的通用类：`card`、`card-header`、`btn`、`input`、`modal`、`status-pill`。画廊特定样式放 `web/css/gallery.css`。

图标使用 `web/index.html` 引入的 Remix Icon class，例如 `ri-settings-4-line`、`ri-key-2-line`。不要新增图标库。

---

## 可访问性

现有 UI 以管理面板为主。新增表单控件应提供清晰 label、placeholder 或 title；图标按钮必须有可理解的 title 或相邻文本。模态框至少保留关闭按钮，并避免只靠颜色表达危险操作。

---

## 常见错误

- 不要在每次渲染时重复注册全局事件而不清理。
- 不要把未转义的 API 返回值拼进模板字符串。
- 不要在一个页面模块里实现另一个页面的导航逻辑；统一走 `router.js`。
- 不要复制 provider 元数据；共享展示信息放在 `utils.js` 的 `providerMeta`。
