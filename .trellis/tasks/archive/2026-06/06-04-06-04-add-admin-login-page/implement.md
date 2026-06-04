# Add Admin Login Page - Implementation Plan

## 执行顺序

1. 后端配置
   - 在 `src/config/manager.ts` 增加 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 读取和 getter。
   - 增加 `isAdminAuthEnabled` 类似 helper，避免调用处重复判断。

2. 后端登录能力
   - 在 `src/app.ts` 增加 Cookie 解析、签名、校验、清除 helper。
   - 增加 `/api/admin/login`、`/api/admin/logout`、`/api/admin/session`。
   - 增加管理页面和管理 API 的保护判断。
   - 明确跳过 `/v1/*`、`/health`、静态资源和登录 API。

3. 前端登录页
   - 新增 `web/js/modules/login.js`。
   - 在 router 注册 `/login`。
   - 在 `apiFetch()` 中处理管理 API 401 跳转。
   - 登录成功后跳转原目标页或 `/admin`。
   - 增加退出登录入口。

4. 文档和 spec
   - README 增加环境变量说明。
   - `.trellis/spec/backend` 增加管理登录鉴权边界。
   - `.trellis/spec/frontend` 增加登录路由和 API 401 处理约定。

5. 验证
   - `deno fmt` / `deno fmt --check`。
   - `deno check src/main.ts`。
   - `deno lint`。
   - 本地服务带 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 启动：
     - 未登录访问 `/admin`。
     - 登录成功后访问 `/admin` 和 `/api/config`。
     - 登出后 `/api/config` 返回 401。
     - `/v1/images/generations` 仍按 Global Access Key / Provider Key 规则访问。
   - 不设置管理员环境变量启动：
     - 管理端保持现有访问行为。

## 回滚点

- 如果 Cookie
  签名或路由保护导致管理端完全不可访问，优先回滚登录保护分支逻辑，保留登录页面代码也不可进入主流程。
- 不修改 `data/runtime-config.json`，避免回滚涉及用户数据。
