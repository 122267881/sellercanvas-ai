const adminApp = document.querySelector("#admin-app");

const state = {
  data: null,
  route: location.hash.replace("#/", "") || "overview",
  filters: {
    customers: "",
    credits: "",
    jobs: "",
  },
};

const routes = [
  { id: "overview", label: "总览" },
  { id: "customers", label: "客户管理" },
  { id: "subscriptions", label: "订阅支付" },
  { id: "credits", label: "积分账户" },
  { id: "jobs", label: "AI 任务" },
  { id: "providers", label: "AI 接口配置" },
  { id: "api", label: "对外 API Key" },
  { id: "usage", label: "用量统计" },
  { id: "logs", label: "审计日志" },
];

const h = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error || payload?.message || "请求失败");
  }
  return payload;
}

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function loadAdmin() {
  try {
    state.data = await api("/api/admin/overview");
    render();
  } catch (error) {
    state.data = null;
    adminApp.innerHTML = renderLogin(error.message);
  }
}

function renderLogin(message = "") {
  return `
    <main class="auth-shell compact">
      <section class="auth-card">
        <div class="brand-block">
          <div class="brand-mark">SC</div>
          <div>
            <strong>SellerCanvas AI</strong>
            <span>开发者管理后台</span>
          </div>
        </div>
        <div>
          <p class="eyebrow">仅限开发者</p>
          <h1>登录管理后台</h1>
          <p class="muted">客户账号不能进入这里。AI Provider、密钥、客户、订阅、支付和用量都在此管理。</p>
        </div>
        ${message ? `<div class="empty-state warn"><strong>${h(message)}</strong></div>` : ""}
        <form id="admin-login" class="settings-grid single">
          <label>管理员邮箱<input name="email" type="email" value="admin@sellercanvas.local" required /></label>
          <label>密码<input name="password" type="password" placeholder="请输入管理员密码" required /></label>
          <button class="primary-button" type="submit">登录后台</button>
        </form>
        <a class="ghost-button full-width" href="/">返回客户使用端</a>
      </section>
    </main>
  `;
}

function render() {
  const pages = {
    overview: overviewPage,
    customers: customersPage,
    subscriptions: subscriptionsPage,
    credits: creditsPage,
    jobs: jobsPage,
    providers: providerPage,
    api: apiKeyPage,
    usage: usagePage,
    logs: logsPage,
  };
  adminApp.innerHTML = shell((pages[state.route] || overviewPage)());
}

function shell(content) {
  const provider = state.data.provider || {};
  const nav = routes
    .map(
      (route) => `
        <a class="${state.route === route.id ? "active" : ""}" href="#/${route.id}">
          ${route.label}
        </a>
      `,
    )
    .join("");

  return `
    <aside class="sidebar admin-sidebar-clean">
      <div class="brand-block">
        <div class="brand-mark">SC</div>
        <div>
          <strong>开发者后台</strong>
          <span>客户不可见</span>
        </div>
      </div>
      <nav class="nav-list">${nav}</nav>
      <div class="sidebar-card">
        <span>AI Provider</span>
        <strong>${h(provider.provider || "local-commercial")}</strong>
        <small>${provider.ready ? "已配置真实接口" : "本地备用模式"}</small>
        <button class="ghost-button" data-action="test-provider">测试接口</button>
      </div>
    </aside>
    <main class="main-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">开发者管理系统</p>
          <h1>${h(routes.find((route) => route.id === state.route)?.label || "总览")}</h1>
        </div>
        <div class="topbar-actions">
          <a class="ghost-button" href="/">客户使用端</a>
          <button class="ghost-button" data-action="export-csv">导出 CSV</button>
          <button class="ghost-button" data-action="logout">退出</button>
        </div>
      </header>
      ${content}
    </main>
  `;
}

function overviewPage() {
  const counts = state.data.counts || {};
  const totals = state.data.credits?.totals || {};
  const jobs = state.data.aiJobs?.counts || {};
  return `
    <section class="metric-grid">
      ${metric("客户", counts.customers)}
      ${metric("项目", counts.projects)}
      ${metric("支付记录", counts.payments)}
      ${metric("AI 任务", counts.aiJobs)}
      ${metric("可用积分", totals.available)}
      ${metric("API 调用", counts.apiCalls)}
    </section>
    <section class="two-column">
      <div class="panel">
        <div class="panel-header"><div><p class="eyebrow">任务状态</p><h2>AI 生产流水线</h2></div></div>
        <div class="settings-grid">
          <label>排队<input value="${h(jobs.QUEUED || 0)}" disabled /></label>
          <label>成功<input value="${h(jobs.SUCCEEDED || 0)}" disabled /></label>
          <label>失败<input value="${h(jobs.FAILED || 0)}" disabled /></label>
          <label>冻结积分<input value="${h(totals.reserved || 0)}" disabled /></label>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><p class="eyebrow">商用检查</p><h2>当前关键能力</h2></div></div>
        <div class="platform-list">
          <div><strong>客户使用端</strong><span>注册、登录、订阅、积分、项目、生成、导出</span></div>
          <div><strong>开发者后台</strong><span>客户、支付、积分、AI Provider、API Key、审计</span></div>
          <div><strong>密钥隔离</strong><span>客户页面不会出现 Provider Key 配置入口</span></div>
        </div>
      </div>
    </section>
  `;
}

function metric(label, value) {
  return `
    <div class="metric-card">
      <span>${h(label)}</span>
      <strong>${h(value || 0)}</strong>
      <small>后台实时统计</small>
    </div>
  `;
}

function customersPage() {
  const rows = filter(state.data.customers || [], state.filters.customers, (user) =>
    `${user.email} ${user.name} ${user.role} ${user.subscription?.plan || ""}`,
  );
  return tablePage(
    "客户管理",
    "搜索客户邮箱、姓名、角色和套餐，客户无法进入开发者后台。",
    "customers",
    "搜索客户邮箱、姓名、角色或套餐",
    rows,
    (user) => `
      <div class="row-card admin-row">
        <div><strong>${h(user.email)}</strong><span>${h(user.name)} · ${h(user.role)}</span></div>
        <span>${h(user.subscription?.plan || "free")}</span>
        <span>${h(user.subscription?.status || "inactive")}</span>
        <small>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("zh-CN") : "未登录"}</small>
      </div>
    `,
  );
}

function subscriptionsPage() {
  return `
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">订阅支付</p><h2>订单、发票与订阅状态</h2></div></div>
      <div class="table-list">
        ${(state.data.payments || [])
          .map(
            (payment) => `
              <div class="row-card admin-row">
                <div><strong>${h(payment.id)}</strong><span>${h(payment.provider)} · ${h(payment.status)}</span></div>
                <span>${h(payment.plan)}</span>
                <span>${h(payment.amount)} ${h(payment.currency)}</span>
                <small>${new Date(payment.createdAt).toLocaleString("zh-CN")}</small>
              </div>
            `,
          )
          .join("") || empty("暂无支付记录", "客户完成订阅后会出现在这里。")}
      </div>
    </section>
  `;
}

function creditsPage() {
  const rows = filter(state.data.credits?.accounts || [], state.filters.credits, (account) =>
    `${account.email} ${account.name} ${account.plan} ${account.status}`,
  );
  return `
    ${tablePage(
      "积分账户",
      "查看客户积分余额、冻结积分和可用积分。",
      "credits",
      "搜索客户邮箱、姓名、套餐或状态",
      rows,
      (account) => `
        <div class="row-card admin-row">
          <div><strong>${h(account.email)}</strong><span>${h(account.plan)} · ${h(account.status)}</span></div>
          <span>余额 ${h(account.balance)}</span>
          <span>冻结 ${h(account.reserved)}</span>
          <strong>可用 ${h(account.available)}</strong>
        </div>
      `,
    )}
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">积分流水</p><h2>最近变动</h2></div></div>
      <div class="timeline">
        ${(state.data.credits?.ledger || [])
          .map(
            (entry) => `
              <div>
                <strong>${h(entry.type || "credit")} · ${h(entry.amount)}</strong>
                <span>${h(entry.reason || entry.meta?.operation || "积分变动")}</span>
              </div>
            `,
          )
          .join("") || empty("暂无积分流水", "客户订阅或使用 AI 后会产生记录。")}
      </div>
    </section>
  `;
}

function jobsPage() {
  const rows = filter(state.data.aiJobs?.items || [], state.filters.jobs, (job) =>
    `${job.id} ${job.userId} ${job.projectId} ${job.type} ${job.status}`,
  );
  return tablePage(
    "AI 任务",
    "排查分析、生图、文案和导出任务状态。",
    "jobs",
    "搜索任务 ID、用户、项目、类型或状态",
    rows,
    (job) => `
      <div class="row-card admin-row">
        <div><strong>${h(job.type)}</strong><span>${h(job.id)} · ${h(job.projectId)}</span></div>
        <span>${h(job.status)}</span>
        <span>${h(job.creditAmount || 0)} 积分</span>
        <small>${job.createdAt ? new Date(job.createdAt).toLocaleString("zh-CN") : ""}</small>
      </div>
    `,
  );
}

function providerPage() {
  const provider = state.data.provider || {};
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">开发者专用</p>
          <h2>AI 接口配置</h2>
        </div>
        <div class="button-row">
          <button class="ghost-button" data-action="test-provider">测试接口</button>
          <button class="primary-button" data-action="save-provider">保存配置</button>
        </div>
      </div>
      <p class="muted">这里配置的是 OpenAI/生图/分析接口密钥。客户使用端不会出现这些配置项。</p>
      <form id="provider-form" class="settings-grid">
        <label>接口模式
          <select name="aiProvider">
            <option value="local-commercial" ${provider.provider !== "openai" ? "selected" : ""}>本地备用模式</option>
            <option value="openai" ${provider.provider === "openai" ? "selected" : ""}>OpenAI API</option>
          </select>
        </label>
        <label>OpenAI API Key
          <input name="openaiApiKey" type="password" placeholder="${provider.ready ? "已配置，留空不修改" : "在这里粘贴 sk-..."}" autocomplete="off" />
        </label>
        <label>Base URL<input name="providerBaseUrl" value="${h(provider.baseUrl || "https://api.openai.com/v1")}" /></label>
        <label>文本/分析模型<input name="textModel" value="${h(provider.textModel || "gpt-5.5")}" /></label>
        <label>生图模型<input name="imageModel" value="${h(provider.imageModel || "gpt-image-2")}" /></label>
        <label>状态<input value="${provider.ready ? "可用" : "未配置真实密钥"}" disabled /></label>
      </form>
    </section>
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">当前配置</p><h2>服务端读取结果</h2></div></div>
      <div class="settings-grid">
        <label>Provider<input value="${h(provider.provider)}" disabled /></label>
        <label>模式<input value="${h(provider.mode)}" disabled /></label>
        <label>Key 来源<input value="${h(provider.keySource)}" disabled /></label>
        <label>Base URL<input value="${h(provider.baseUrl)}" disabled /></label>
      </div>
    </section>
  `;
}

function apiKeyPage() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">开发者专用</p>
          <h2>对外 API Key</h2>
        </div>
        <button class="primary-button" data-action="create-api-key">生成 API Key</button>
      </div>
      <p class="muted">这是给系统集成或客户服务端调用 SellerCanvas 对外 API 的 Key，不是 OpenAI API Key。</p>
      <div class="table-list">
        ${(state.data.apiKeys || [])
          .map(
            (key) => `
              <div class="row-card admin-row">
                <div><strong>${h(key.name)}</strong><span>${h(key.prefix)}... · ${h(key.userId)}</span></div>
                <span>${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("zh-CN") : "未使用"}</span>
                <span>${h(key.createdAt ? new Date(key.createdAt).toLocaleDateString("zh-CN") : "")}</span>
                <button class="ghost-button" data-action="revoke-api-key" data-id="${h(key.id)}">吊销</button>
              </div>
            `,
          )
          .join("") || empty("暂无 API Key", "点击生成后，密钥只显示一次，请立即保存。")}
      </div>
    </section>
    <section class="panel">
      <pre class="code-block">POST /v1/generate
Authorization: Bearer sk_live_xxx
Rate limit: 60 requests / minute / key</pre>
    </section>
  `;
}

function usagePage() {
  return `
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">用量统计</p><h2>API 调用记录</h2></div></div>
      <div class="timeline">
        ${(state.data.apiUsage || [])
          .map(
            (item) => `
              <div>
                <strong>${h(item.endpoint)} · ${h(item.status)}</strong>
                <span>${h(item.userId)} · ${h(item.units)} unit · ${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              </div>
            `,
          )
          .join("") || empty("暂无 API 调用", "通过对外 API 生成内容后会出现在这里。")}
      </div>
    </section>
  `;
}

function logsPage() {
  return `
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">审计日志</p><h2>系统关键动作</h2></div></div>
      <div class="timeline">
        ${(state.data.latestLogs || [])
          .map(
            (item) => `
              <div>
                <strong>${h(item.type)}</strong>
                <span>${h(item.message)} · ${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              </div>
            `,
          )
          .join("") || empty("暂无审计日志", "登录、配置、支付、生成等关键动作会记录。")}
      </div>
    </section>
  `;
}

function tablePage(title, subtitle, filterKey, placeholder, rows, renderRow) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${h(title)}</p>
          <h2>${h(subtitle)}</h2>
        </div>
      </div>
      <input class="admin-search" value="${h(state.filters[filterKey] || "")}" placeholder="${h(placeholder)}" data-filter="${h(filterKey)}" />
    </section>
    <section class="table-list">
      ${rows.map(renderRow).join("") || empty("没有匹配数据", "换一个关键词再试。")}
    </section>
  `;
}

function empty(title, detail) {
  return `
    <div class="empty-state">
      <strong>${h(title)}</strong>
      <span>${h(detail)}</span>
    </div>
  `;
}

function filter(rows, term, stringify) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => stringify(row).toLowerCase().includes(needle));
}

async function handleAction(action, target) {
  try {
    if (action === "logout") {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      state.data = null;
      adminApp.innerHTML = renderLogin();
      return;
    }
    if (action === "export-csv") {
      exportCsv();
      return;
    }
    if (action === "test-provider") {
      const result = await api("/api/admin/test-provider", { method: "POST", body: "{}" });
      toast(result.ok ? `接口可用：${result.provider.mode}` : "接口不可用", result.ok ? "success" : "error");
      return;
    }
    if (action === "save-provider") {
      const values = Object.fromEntries(new FormData(document.querySelector("#provider-form")));
      const result = await api("/api/admin/provider-config", {
        method: "POST",
        body: JSON.stringify({ config: values }),
      });
      state.data.provider = result.provider;
      toast("AI 接口配置已保存");
      render();
      return;
    }
    if (action === "create-api-key") {
      const name = prompt("API Key 名称", "Server integration key");
      if (!name) return;
      const result = await api("/api/developer/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await navigator.clipboard?.writeText(result.secret).catch(() => {});
      window.prompt("密钥只显示一次，已尝试复制到剪贴板，请立即保存：", result.secret);
      state.data = await api("/api/admin/overview");
      render();
      return;
    }
    if (action === "revoke-api-key") {
      if (!confirm("确定要吊销这个 API Key 吗？")) return;
      await api(`/api/developer/api-keys/${target.dataset.id}`, { method: "DELETE" });
      state.data = await api("/api/admin/overview");
      toast("API Key 已吊销");
      render();
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

function exportCsv() {
  const rows = [["type", "id", "email_or_user", "status", "createdAt"]];
  (state.data.customers || []).forEach((user) =>
    rows.push(["customer", user.id, user.email, user.subscription?.status || "", user.createdAt]),
  );
  (state.data.payments || []).forEach((payment) =>
    rows.push(["payment", payment.id, payment.userId, payment.status, payment.createdAt]),
  );
  (state.data.apiUsage || []).forEach((item) =>
    rows.push(["api", item.id, item.userId, item.endpoint, item.createdAt]),
  );
  (state.data.credits?.accounts || []).forEach((account) =>
    rows.push(["credit_account", account.userId, account.email, `available:${account.available}`, ""]),
  );
  (state.data.aiJobs?.items || []).forEach((job) =>
    rows.push(["ai_job", job.id, job.userId, job.status, job.createdAt || ""]),
  );
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "sellercanvas-admin-export.csv";
  link.click();
}

adminApp.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  event.preventDefault();
  handleAction(target.dataset.action, target);
});

adminApp.addEventListener("input", (event) => {
  const input = event.target.closest("[data-filter]");
  if (!input) return;
  state.filters[input.dataset.filter] = input.value;
  render();
});

adminApp.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.target.matches("#admin-login")) return;

  try {
    const payload = Object.fromEntries(new FormData(event.target));
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    toast("后台登录成功");
    await loadAdmin();
  } catch (error) {
    toast(error.message, "error");
  }
});

window.addEventListener("hashchange", () => {
  state.route = location.hash.replace("#/", "") || "overview";
  if (state.data) render();
});

loadAdmin();
