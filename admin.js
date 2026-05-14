const adminApp = document.querySelector("#adminApp");
const toast = document.querySelector("#toast");

const adminState = {
  data: null,
  route: location.hash.replace("#/", "") || "overview",
  filters: {
    customers: "",
    credits: "",
    jobs: ""
  }
};

const adminRoutes = [
  { id: "overview", label: "总览" },
  { id: "customers", label: "客户管理" },
  { id: "subscriptions", label: "订阅支付" },
  { id: "credits", label: "积分账户" },
  { id: "jobs", label: "AI任务" },
  { id: "api", label: "API管理" },
  { id: "providers", label: "Provider配置" },
  { id: "usage", label: "用量统计" },
  { id: "logs", label: "审计日志" }
];

function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || payload.error || "请求失败";
    throw new Error(message);
  }
  return payload;
}

async function loadAdmin() {
  try {
    adminState.data = await api("/api/admin/overview");
    renderAdmin();
  } catch (error) {
    adminState.data = null;
    adminApp.innerHTML = adminLogin(error.message);
    bindAdmin();
  }
}

function adminLogin(message = "") {
  return `
    <main class="auth-page">
      <section class="auth-card">
        <a class="brand" href="/admin">
          <span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Zm0 4L7 8.8v5.8l5 2.8 5-2.8V8.8L12 6Z"/></svg></span>
          <span>SellerCanvas 管理后台</span>
        </a>
        <div class="auth-head">
          <h1>开发者后台登录</h1>
          <p>仅限管理员访问。客户账号不能进入此系统。</p>
        </div>
        ${message ? `<div class="empty-card warn">${h(message)}</div>` : ""}
        <form class="auth-form" data-form="admin-login">
          <label>管理员邮箱<input name="email" type="email" value="admin@sellercanvas.local" required></label>
          <label>密码<input name="password" type="password" value="Admin123!ChangeMe" required></label>
          <button class="generate-btn" data-admin-action="login" type="button">登录管理后台</button>
        </form>
        <a class="secondary-btn" href="/">返回客户站</a>
      </section>
    </main>
  `;
}

function adminShell(content) {
  const data = adminState.data;
  const providerReady = data.provider.ready ? "已就绪" : "未就绪";
  return `
    <header class="topbar admin-topbar">
      <a class="brand" href="/admin">
        <span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Zm0 4L7 8.8v5.8l5 2.8 5-2.8V8.8L12 6Z"/></svg></span>
        <span>SellerCanvas 管理后台</span>
      </a>
      <nav class="nav-tabs">${adminRoutes.map((route) => `<a class="${adminState.route === route.id ? "is-active" : ""}" href="#/${route.id}">${route.label}</a>`).join("")}</nav>
      <div class="top-actions">
        <a class="secondary-btn" href="/">客户站</a>
        <button class="secondary-btn" data-admin-action="logout">退出</button>
      </div>
    </header>
    <main class="admin-layout">
      <aside class="admin-sidebar">
        <div class="panel-title">系统状态</div>
        <div class="current-project">
          <strong>${h(data.provider.provider)}</strong>
          <span>${h(data.provider.mode)} · ${providerReady}</span>
        </div>
        <div class="panel-title small">管理入口</div>
        ${adminRoutes.map((route) => `<button data-admin-route="${route.id}">${route.label}</button>`).join("")}
      </aside>
      <section class="admin-main">${content}</section>
    </main>
  `;
}

function renderAdmin() {
  const pages = {
    overview: overviewPage,
    customers: customersPage,
    subscriptions: subscriptionsPage,
    credits: creditsPage,
    jobs: jobsPage,
    api: apiPage,
    providers: providersPage,
    usage: usagePage,
    logs: logsPage
  };
  adminApp.innerHTML = adminShell((pages[adminState.route] || overviewPage)());
  bindAdmin();
}

function overviewPage() {
  const c = adminState.data.counts;
  const totals = adminState.data.credits?.totals || { balance: 0, reserved: 0, available: 0 };
  const jobs = adminState.data.aiJobs?.counts || {};
  return `
    <div class="page-head">
      <div>
        <h1>运营总览</h1>
        <p class="subhead">集中查看客户、支付、积分、AI任务、API调用和 Provider 状态。</p>
      </div>
      <button class="secondary-btn" data-admin-action="export-csv">导出数据</button>
    </div>
    <div class="metric-grid admin-metrics">
      <article><strong>${c.customers}</strong><span>客户</span></article>
      <article><strong>${c.projects}</strong><span>项目</span></article>
      <article><strong>${c.payments}</strong><span>支付记录</span></article>
      <article><strong>${c.aiJobs}</strong><span>AI任务</span></article>
      <article><strong>${totals.available}</strong><span>可用积分</span></article>
      <article><strong>${c.apiCalls}</strong><span>API调用</span></article>
    </div>
    <section class="panel">
      <div class="section-head"><h2>任务状态</h2><span class="status-pill">${jobs.SUCCEEDED || 0} 成功</span></div>
      <div class="kv-list admin-kv">
        <div><span>排队</span><b>${jobs.QUEUED || 0}</b></div>
        <div><span>成功</span><b>${jobs.SUCCEEDED || 0}</b></div>
        <div><span>失败</span><b>${jobs.FAILED || 0}</b></div>
        <div><span>冻结积分</span><b>${totals.reserved}</b></div>
      </div>
    </section>
  `;
}

function customersPage() {
  const users = filterRows(adminState.data.customers, adminState.filters.customers, (user) => `${user.email} ${user.name} ${user.role} ${user.subscription?.plan || ""}`);
  return `
    <div class="page-head">
      <div><h1>客户管理</h1><p class="subhead">搜索、筛选和导出客户，查看客户订阅状态。</p></div>
      <button class="secondary-btn" data-admin-action="export-csv">导出 CSV</button>
    </div>
    <section class="panel"><input class="admin-search" placeholder="搜索客户邮箱、姓名、角色或套餐" value="${h(adminState.filters.customers)}" data-admin-filter="customers"></section>
    <div class="table-card">
      ${users.map(customerRow).join("") || `<div class="empty-card">没有匹配客户</div>`}
    </div>
  `;
}

function customerRow(user) {
  return `
    <article class="row-card admin-row">
      <div><strong>${h(user.email)}</strong><span>${h(user.name)} · ${h(user.role)}</span></div>
      <span>${h(user.subscription?.plan || "free")}</span>
      <span>${h(user.subscription?.status || "inactive")}</span>
      <small>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "未登录"}</small>
    </article>
  `;
}

function subscriptionsPage() {
  return `
    <div class="page-head"><div><h1>订阅支付</h1><p class="subhead">查看支付、发票和订阅状态。</p></div></div>
    <section class="panel">
      <h2>支付记录</h2>
      <div class="table-card">
        ${adminState.data.payments.map((pay) => `
          <article class="row-card admin-row">
            <div><strong>${h(pay.id)}</strong><span>${h(pay.provider)} · ${h(pay.status)}</span></div>
            <span>${h(pay.plan)}</span>
            <b>${pay.amount} ${h(pay.currency)}</b>
            <small>${new Date(pay.createdAt).toLocaleString()}</small>
          </article>
        `).join("") || `<div class="empty-card">暂无支付记录</div>`}
      </div>
    </section>
  `;
}

function creditsPage() {
  const accounts = filterRows(adminState.data.credits?.accounts || [], adminState.filters.credits, (account) => `${account.email} ${account.name} ${account.plan} ${account.status}`);
  const ledger = adminState.data.credits?.ledger || [];
  return `
    <div class="page-head">
      <div><h1>积分账户</h1><p class="subhead">查看客户积分余额、冻结积分和最近积分流水。</p></div>
      <button class="secondary-btn" data-admin-action="export-csv">导出 CSV</button>
    </div>
    <section class="panel"><input class="admin-search" placeholder="搜索客户邮箱、姓名、套餐或状态" value="${h(adminState.filters.credits)}" data-admin-filter="credits"></section>
    <div class="table-card">
      ${accounts.map((account) => `
        <article class="row-card admin-row">
          <div><strong>${h(account.email)}</strong><span>${h(account.plan)} · ${h(account.status)}</span></div>
          <span>余额 ${account.balance}</span>
          <span>冻结 ${account.reserved}</span>
          <b>可用 ${account.available}</b>
        </article>
      `).join("") || `<div class="empty-card">没有匹配积分账户</div>`}
    </div>
    <section class="panel">
      <div class="section-head"><h2>最近积分流水</h2><span class="status-pill">${ledger.length} 条</span></div>
      <div class="timeline compact">
        ${ledger.map((entry) => `
          <article>
            <span>${h(entry.type || "credit")}</span>
            <strong>${h(entry.userId)} · ${entry.amount}</strong>
            <p>${h(entry.reason || entry.meta?.operation || "积分变动")}</p>
          </article>
        `).join("") || `<div class="empty-card">暂无积分流水</div>`}
      </div>
    </section>
  `;
}

function jobsPage() {
  const jobs = filterRows(adminState.data.aiJobs?.items || [], adminState.filters.jobs, (job) => `${job.id} ${job.userId} ${job.projectId} ${job.type} ${job.status}`);
  return `
    <div class="page-head">
      <div><h1>AI任务</h1><p class="subhead">查看分析、生图、文案和导出任务状态，便于排查失败和退款。</p></div>
      <button class="secondary-btn" data-admin-action="export-csv">导出 CSV</button>
    </div>
    <section class="panel"><input class="admin-search" placeholder="搜索任务ID、用户、项目、类型或状态" value="${h(adminState.filters.jobs)}" data-admin-filter="jobs"></section>
    <div class="table-card">
      ${jobs.map((job) => `
        <article class="row-card admin-row">
          <div><strong>${h(job.type)}</strong><span>${h(job.id)} · ${h(job.projectId)}</span></div>
          <span>${h(job.status)}</span>
          <span>${job.creditAmount || 0} 积分</span>
          <small>${job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}</small>
        </article>
      `).join("") || `<div class="empty-card">暂无 AI 任务</div>`}
    </div>
  `;
}

function apiPage() {
  return `
    <div class="page-head">
      <div><h1>API管理</h1><p class="subhead">仅开发者后台可配置 API Key。客户站不会出现 API 配置入口。</p></div>
      <button class="generate-btn" data-admin-action="create-api-key">生成 API Key</button>
    </div>
    <section class="panel">
      <div class="section-head"><h2>API Keys</h2></div>
      <div class="table-card">
        ${(adminState.data.apiKeys || []).map((key) => `
          <article class="row-card admin-row">
            <div><strong>${h(key.name)}</strong><span>${h(key.prefix)}... · ${h(key.userId)}</span></div>
            <span>${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "未使用"}</span>
            <button data-admin-action="revoke-api-key" data-id="${h(key.id)}">吊销</button>
          </article>
        `).join("") || `<div class="empty-card">暂无 API Key。</div>`}
      </div>
    </section>
    <section class="panel">
      <pre class="code-block">POST /v1/generate
Authorization: Bearer sk_live_xxx
Rate limit: 60 requests / minute / key</pre>
    </section>
    ${usagePage()}
  `;
}

function providersPage() {
  const p = adminState.data.provider;
  return `
    <div class="page-head">
      <div><h1>Provider配置</h1><p class="subhead">外部 AI、支付和 OAuth 配置只存在于管理后台，不出现在客户站。</p></div>
      <button class="secondary-btn" data-admin-action="test-provider">测试 Provider</button>
    </div>
    <section class="panel">
      <div class="kv-list admin-kv">
        <div><span>Provider</span><b>${h(p.provider)}</b></div>
        <div><span>模式</span><b>${h(p.mode)}</b></div>
        <div><span>Key 来源</span><b>${h(p.keySource)}</b></div>
        <div><span>Base URL</span><b>${h(p.baseUrl)}</b></div>
        <div><span>文本模型</span><b>${h(p.textModel)}</b></div>
        <div><span>生图模型</span><b>${h(p.imageModel)}</b></div>
      </div>
      ${p.fallbackReason ? `<div class="empty-card warn">${h(p.fallbackReason)}</div>` : ""}
    </section>
  `;
}

function usagePage() {
  return `
    <div class="page-head">
      <div><h1>用量统计</h1><p class="subhead">按 API 调用查看客户使用量。</p></div>
      <button class="secondary-btn" data-admin-action="export-csv">导出 CSV</button>
    </div>
    <div class="timeline compact">
      ${adminState.data.apiUsage.map((item) => `
        <article>
          <span>${h(item.endpoint)}</span>
          <strong>${h(item.userId)}</strong>
          <p>${item.units} unit · ${h(item.status)}</p>
          <small>${new Date(item.createdAt).toLocaleString()}</small>
        </article>
      `).join("") || `<div class="empty-card">暂无 API 调用</div>`}
    </div>
  `;
}

function logsPage() {
  return `
    <div class="page-head"><div><h1>审计日志</h1><p class="subhead">系统关键动作记录。</p></div></div>
    <div class="timeline compact">
      ${adminState.data.latestLogs.map((item) => `
        <article>
          <span>${h(item.type)}</span>
          <strong>${h(item.message)}</strong>
          <small>${new Date(item.createdAt).toLocaleString()}</small>
        </article>
      `).join("") || `<div class="empty-card">暂无审计日志</div>`}
    </div>
  `;
}

function bindAdmin() {
  document.querySelectorAll("[data-admin-route]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `#/${button.dataset.adminRoute}`;
    });
  });
  document.querySelectorAll("[data-admin-action]").forEach((button) => button.addEventListener("click", handleAdminAction));
  document.querySelectorAll("[data-admin-filter]").forEach((input) => input.addEventListener("input", handleFilter));
}

async function handleAdminAction(event) {
  const action = event.currentTarget.dataset.adminAction;
  try {
    if (action === "login") {
      const data = Object.fromEntries(new FormData(document.querySelector("[data-form='admin-login']")).entries());
      await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
      await loadAdmin();
      return;
    }
    if (action === "logout") {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      adminState.data = null;
      adminApp.innerHTML = adminLogin();
      bindAdmin();
      return;
    }
    if (action === "test-provider") {
      const result = await api("/api/admin/test-provider", { method: "POST", body: "{}" });
      showToast(result.ok ? `Provider 可用：${result.provider.mode}` : "Provider 不可用");
      return;
    }
    if (action === "create-api-key") return createAdminApiKey();
    if (action === "revoke-api-key") return revokeAdminApiKey(event.currentTarget.dataset.id);
    if (action === "export-csv") exportCsv();
  } catch (error) {
    showToast(error.message);
  }
}

async function createAdminApiKey() {
  const name = prompt("API Key 名称", "Server integration key");
  if (!name) return;
  const result = await api("/api/developer/api-keys", { method: "POST", body: JSON.stringify({ name }) });
  await navigator.clipboard.writeText(result.secret).catch(() => {});
  showToast(`API Key 已生成：${result.secret}`);
  adminState.data = await api("/api/admin/overview");
  renderAdmin();
}

async function revokeAdminApiKey(keyId) {
  if (!confirm("确定吊销这个 API Key 吗？")) return;
  await api(`/api/developer/api-keys/${keyId}`, { method: "DELETE" });
  showToast("API Key 已吊销");
  adminState.data = await api("/api/admin/overview");
  renderAdmin();
}

function handleFilter(event) {
  adminState.filters[event.target.dataset.adminFilter] = event.target.value;
  renderAdmin();
}

function filterRows(rows, term, stringify) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => stringify(row).toLowerCase().includes(needle));
}

function exportCsv() {
  const rows = [["type", "id", "email_or_user", "status", "createdAt"]];
  adminState.data.customers.forEach((user) => rows.push(["customer", user.id, user.email, user.subscription?.status || "", user.createdAt]));
  adminState.data.payments.forEach((pay) => rows.push(["payment", pay.id, pay.userId, pay.status, pay.createdAt]));
  adminState.data.apiUsage.forEach((item) => rows.push(["api", item.id, item.userId, item.endpoint, item.createdAt]));
  (adminState.data.credits?.accounts || []).forEach((account) => rows.push(["credit_account", account.userId, account.email, `available:${account.available}`, ""]));
  (adminState.data.aiJobs?.items || []).forEach((job) => rows.push(["ai_job", job.id, job.userId, job.status, job.createdAt || ""]));
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "sellercanvas-admin-export.csv";
  link.click();
}

window.addEventListener("hashchange", () => {
  adminState.route = location.hash.replace("#/", "") || "overview";
  if (adminState.data) renderAdmin();
});

loadAdmin();
