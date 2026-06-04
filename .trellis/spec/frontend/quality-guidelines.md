# 前端质量规范

> 前端质量目标是少依赖、可刷新、可回退、与后端配置结构一致。

---

## 总览

前端由 Deno 静态服务直接提供，所有 JS 文件仍会被 `deno lint` 检查。修改管理端后优先启动本地服务并在浏览器验证目标页面。

---

## 禁止模式

- 不要引入 npm 前端框架、构建工具或 CSS 预处理器。
- 不要在模板字符串里插入未转义的用户输入或 API 返回文本。
- 不要把页面刷新依赖内存状态；直接打开 `/channel`、`/keys` 等路径必须能由后端 SPA fallback 返回。
- 不要复制后端 provider/model/size 逻辑后忘记同步。需要展示时尽量从 `/api/config` 或后端 API 获取。
- 不要让保存操作无防抖地频繁写运行时配置。

---

## 必须模式

- API 请求使用 `apiFetch()`，需要鉴权时依赖 `localStorage.authToken`。
- 页面路由通过 `data-link` 和 `navigateTo()`，不要手写 `location.href` 刷新。
- 有全局事件或定时器的页面必须设置 `container.cleanup`。
- 显示 Provider 信息时复用 `providerMeta`。
- 表单自动保存要有 loading/error 反馈或可见状态变化。

---

## 验证要求

静态检查：

```bash
deno lint
deno check src/main.ts
```

交互改动应启动：

```bash
deno task dev
```

然后用浏览器访问目标页面，例如 `http://localhost:10001/admin`、`/channel`、`/keys`、`/pic`。涉及响应式布局或 modal 时至少检查主要桌面宽度。

---

## Code Review Checklist

- 目标页面能直接刷新打开。
- 事件监听不会重复叠加或泄漏。
- 所有用户可控文本都已转义。
- 前后端字段名、provider 名称和 task 名称一致。
- UI 改动复用现有 class，不新增一次性样式体系。
