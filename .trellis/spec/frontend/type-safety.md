# 类型安全规范

> 后端使用严格 TypeScript；前端是原生 JavaScript + JSDoc 注释，没有编译期类型检查。

---

## 总览

共享请求/响应类型集中在 `src/types/request.ts` 和 `src/types/provider.ts`。Provider 和配置类型主要在 `src/providers/base.ts` 与 `src/config/manager.ts`。新增后端字段时必须先更新类型，再更新实现。

前端使用 JSDoc 描述对象形状，例如 `router.js` 的 routes、`store.js` 的 state、`utils.js` 的 providerMeta。

---

## 类型组织

- OpenAI 兼容请求/响应：`ImagesRequest`、`ImagesEditRequest`、`ImageGenerationRequest`、`ImagesResponse`。
- Provider 能力和配置：`ProviderCapabilities`、`ProviderConfig`、`GenerationOptions`。
- 运行时配置：`RuntimeConfig`、`ProviderRuntimeConfig`、`ProviderTaskDefaults`、`KeyPoolItem`。

不要在多个文件里重复定义同一结构。需要跨模块共享时从上述类型文件导入。

---

## 运行时校验

项目没有 Zod/Yup。运行时校验通过显式判断完成：

- `BaseProvider.validateRequest()` 校验 prompt、输入图片数量和 provider 能力。
- `app.ts` 管理 API 使用 `typeof`、`Array.isArray()`、对象判断校验请求体。
- `utils/security.ts` 负责 URL 安全和 SSRF 防护。

新增外部输入必须做运行时校验，不能只依赖 TypeScript interface。

---

## 常用模式

- 对 `unknown` JSON 先判断对象再取字段。
- 对 provider 名称使用 `ProviderName` 联合类型。
- 对动态 provider/task 配置使用窄化：`task === "text" || task === "edit" || task === "blend"`。
- 对错误对象使用 `err instanceof Error ? err.message : String(err)`。

---

## 禁止模式

- 不要在新代码中扩大 `any` 使用。既有 `deno-lint-ignore no-explicit-any` 只保留在局部兼容点。
- 不要用类型断言掩盖未验证的请求体。
- 不要让前端表单字段名和后端类型字段名漂移。
- 不要把可选字段当必填使用，特别是 `runtimeConfig.storage`、`promptOptimizer`、`hfModelMap`、`keyPools`。
