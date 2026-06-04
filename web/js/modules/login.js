/**
 * 管理端登录页
 */

/**
 * 渲染登录页面
 *
 * @param {HTMLElement} container - 内容容器
 */
export function renderLogin(container) {
  container.innerHTML = `
    <section class="login-shell">
      <div class="login-panel">
        <div class="login-brand">
          <div class="login-logo"><i class="ri-router-line"></i></div>
          <div>
            <h1>ImgRouter</h1>
            <p>管理端登录</p>
          </div>
        </div>
        <form id="adminLoginForm" class="login-form">
          <label>
            <span>用户名</span>
            <input id="adminUsername" class="form-control" name="username" autocomplete="username" required>
          </label>
          <label>
            <span>密码</span>
            <input id="adminPassword" class="form-control" name="password" type="password" autocomplete="current-password" required>
          </label>
          <div id="loginError" class="login-error" hidden></div>
          <button id="loginSubmit" class="btn btn-primary" type="submit">
            <i class="ri-login-box-line"></i>
            <span>登录</span>
          </button>
        </form>
      </div>
    </section>
  `;

  const form = document.getElementById("adminLoginForm");
  form?.addEventListener("submit", handleLoginSubmit);
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("adminUsername")?.value.trim() || "";
  const password = document.getElementById("adminPassword")?.value || "";
  const errorEl = document.getElementById("loginError");
  const submit = document.getElementById("loginSubmit");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }
  if (submit) submit.disabled = true;

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      throw new Error("用户名或密码错误");
    }

    const params = new URLSearchParams(globalThis.location.search);
    const next = sanitizeNextPath(params.get("next")) || "/admin";
    globalThis.location.href = next;
  } catch (e) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = e instanceof Error ? e.message : "登录失败";
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

function sanitizeNextPath(next) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "";
  if (next === "/login") return "/admin";
  return next;
}
