# Add Admin Login Page - Design

## 范围

本任务为管理端新增独立登录保护，不改变 OpenAI 兼容 API 的现有鉴权模型。

受影响区域：

- `src/config/manager.ts`：读取管理员环境变量并导出配置。
- `src/app.ts`：新增登录 API、Cookie 校验、管理页面和管理 API 保护。
- `web/js/modules/router.js`、`web/js/modules/utils.js`、`web/js/main.js`：前端会话检查、401
  处理和跳转。
- `web/js/modules/login.js`（新增）：登录页面。
- `web/index.html`、`web/css/style.css`：导航/退出入口和登录页样式。
- README / Trellis spec：环境变量和鉴权边界说明。

## 契约

### 环境变量

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

启用条件：两者同时非空。未启用时管理端保持现有访问行为。

### API

`POST /api/admin/login`

Request：

```json
{
  "username": "admin",
  "password": "secret"
}
```

Success：

- `200 {"ok": true}`
- 设置 `Set-Cookie: img_router_admin_session=...; HttpOnly; SameSite=Lax; Path=/`

Failure：

- `401 {"error":"Invalid username or password"}`

`POST /api/admin/logout`

- 清除 `img_router_admin_session`。
- 返回 `200 {"ok": true}`。

`GET /api/admin/session`

Response：

```json
{
  "enabled": true,
  "authenticated": true
}
```

### Cookie 策略

- Cookie 名：`img_router_admin_session`。
- Cookie 内容：服务端签名 token，前端不可读。
- 签名：优先使用 Web Crypto HMAC SHA-256，不新增依赖。
- Token 载荷包含用户名、过期时间和随机 nonce。
- 签名密钥来源：首版可从 `ADMIN_PASSWORD` 派生，配合过期时间和 HMAC 防篡改；后续如需要可新增
  `ADMIN_SESSION_SECRET`。

## 鉴权边界

### 需要管理登录

- SPA
  页面：`/admin`、`/setting`、`/channel`、`/keys`、`/pic`、`/prompt-optimizer`、`/update`、`/ui`、`/index`。
- 管理
  API：`/api/config`、`/api/key-pool`、`/api/runtime-config`、`/api/dashboard/stats`、`/api/restart-docker`、`/api/config/*`、`/api/tools/*`、`/api/gallery`、`/api/logs/stream`、`/api/update/check`。

### 不需要管理登录

- `/login`
- `/api/admin/login`
- `/api/admin/logout`
- `/api/admin/session`
- `/health`
- `/v1/*`
- `/css/*`
- `/js/*`
- `/storage/*`

## 数据流

1. 浏览器访问 `/admin`。
2. 后端发现管理登录启用且 Cookie 无效，返回 `/login` SPA 外壳或让前端路由守卫跳转。
3. 用户提交用户名和密码到 `/api/admin/login`。
4. 后端校验环境变量，成功后设置 HttpOnly Cookie。
5. 前端跳转回原目标页。
6. 管理 API 依赖 Cookie 校验，不依赖 `localStorage.authToken`。
7. `/v1/*` 请求仍只走现有 `checkAuth()` / Provider Key 识别，不读取管理 Cookie。

## 设计取舍

- KISS：只实现单管理员账号，不引入用户表和权限系统。
- YAGNI：不做 OAuth、多用户、刷新 token 或独立 session 存储。
- SRP：登录相关校验集中在 `src/app.ts` 或小型 helper 内；Provider、handler 不感知管理登录。
- DRY：前端 API 401 跳转逻辑放在 `apiFetch()`，页面模块不重复处理。

## 风险

- 如果后端只保护页面、不保护 API，会导致绕过登录直接调用管理接口；实现时必须同时保护两者。
- 如果把管理 Cookie 保护套到 `/v1/*`，会破坏用户要求的生图接口访问方式。
- 如果默认强制启用登录，会锁死未配置环境变量的已有部署；必须按启用条件兼容。
