# Add Admin Login Page

## 背景

当前 ImgRouter 的管理端页面（`/admin`、`/setting`、`/channel`、`/keys`、`/pic`
等）主要依赖浏览器本地保存的 `authToken` 给管理 API 附加
`Authorization`。这套机制更偏向“全局访问密钥”复用，不是独立的管理端登录。

用户希望新增一个登录页面，通过环境变量设置管理员用户名和密码。未登录用户不能进入管理主页；但 OpenAI
兼容生图接口仍必须保持现有访问方式，通过 `Global Access Key` 或中转模式 Provider Key
访问，不被管理端登录态影响。

## 目标

- 新增管理端登录页面。
- 管理端登录凭据从环境变量读取。
- 未登录时访问管理页面会进入登录页，不能看到管理主页和管理功能页面。
- 管理端 API 需要登录态保护，避免只拦页面不拦接口。
- `/v1/images/generations`、`/v1/images/edits`、`/v1/images/blend`、`/v1/chat/completions`
  继续使用现有 `Global Access Key` / Provider Key 鉴权，不读取或要求管理登录 Cookie。

## 需求

### 后端需求

- 新增管理员环境变量：
  - `ADMIN_USERNAME`：管理员用户名。
  - `ADMIN_PASSWORD`：管理员密码。
- 兼容性要求：只有 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`
  同时存在且非空时，才启用管理端登录保护；否则保持现有管理端行为，避免升级后直接锁死已有部署。
- 新增登录相关 API：
  - `POST /api/admin/login`：校验用户名和密码，成功后设置 HttpOnly Cookie。
  - `POST /api/admin/logout`：清除登录 Cookie。
  - `GET /api/admin/session`：返回当前是否已登录，用于前端路由守卫。
- 管理端登录态使用服务端可验证的 Cookie，不把密码或明文凭据写入 `localStorage`。
- Cookie 至少需要 `HttpOnly`、`SameSite=Lax`、`Path=/`；生产 HTTPS 场景可后续补 `Secure` 策略。
- 管理页面和管理 API 需要登录保护：
  - 页面：`/admin`、`/setting`、`/channel`、`/keys`、`/pic`、`/prompt-optimizer`、`/update`、`/ui`、`/index`。
  - API：`/api/config`、`/api/key-pool`、`/api/runtime-config`、`/api/dashboard/stats`、`/api/restart-docker`、`/api/config/*`、`/api/tools/*`、`/api/gallery`、`/api/logs/stream`、`/api/update/check`。
- 不得把管理登录保护应用到：
  - `/health`。
  - `/v1/*` OpenAI 兼容接口。
  - `/storage/*` 生成图片静态资源（本任务不改变现有访问策略）。
  - `/css/*`、`/js/*`、登录页面自身需要的静态资源。

### 前端需求

- 新增 `/login` 页面或等价登录视图。
- 未登录时进入管理页面自动显示登录页；登录成功后跳转到原目标页，默认 `/admin`。
- 已登录时访问 `/login` 应跳转到 `/admin` 或原目标页。
- 提供退出登录入口，退出后回到登录页。
- 管理端 API 请求继续通过统一 `apiFetch()`；当管理 API 返回 401 时，前端应跳转登录页。
- 不再把管理员用户名/密码存入 `localStorage`。
- 不影响现有“全局访问密钥”配置字段；该字段仍只用于后端模式下保护生图接口。

### 文档需求

- README 补充 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 环境变量说明。
- 说明管理登录与 `Global Access Key` 的区别：
  - 管理登录保护 Web 管理端。
  - `Global Access Key` 保护 OpenAI 兼容 API 的后端模式访问。
- 如新增登录 Cookie 或管理鉴权约定，需要同步 `.trellis/spec`。

## 非目标

- 不新增 OAuth、第三方登录、多用户、角色权限、密码找回。
- 不新增数据库或用户表。
- 不改变 Provider Key 池结构。
- 不改变 `/v1/*` 当前鉴权语义。
- 不要求登录页面支持复杂主题或多语言。

## 验收标准

- [ ] 设置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 后，未登录访问 `/admin`
      会进入登录页，不能看到管理主页内容。
- [ ] 登录成功后可以进入 `/admin`、`/setting`、`/channel`、`/keys` 等管理页面。
- [ ] 登录失败返回清晰错误，不泄露密码是否正确等敏感细节。
- [ ] 未登录直接请求受保护管理 API 返回 401。
- [ ] 登录后受保护管理 API 正常返回。
- [ ] 退出登录后再次访问管理页面需要重新登录。
- [ ] 未设置 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 时，管理端保持现有可访问行为。
- [ ] `/v1/images/generations` 等生图接口仍可通过 `Global Access Key` 或 Provider Key
      访问，不要求管理登录 Cookie。
- [ ] README 和 Trellis spec 已同步。
- [ ] `deno check src/main.ts` 通过。
- [ ] `deno lint` 通过。
- [ ] 本地服务启动后用真实 HTTP 请求验证登录、登出、管理 API 401、生图接口不受登录态影响。

## 开放问题

- 是否需要把登录 Cookie 过期时间做成环境变量。首版建议固定合理时长（例如 7 天），保持 KISS。
