const API_BASE = "";

const app = document.querySelector("#app");

const routes = [
  { hash: "dashboard", label: "工作台" },
  { hash: "projects", label: "项目" },
  { hash: "templates", label: "模板" },
  { hash: "history", label: "历史" },
  { hash: "exports", label: "导出" },
  { hash: "billing", label: "订阅" },
  { hash: "settings", label: "账号" },
];

const assetLabels = {
  main: "主图",
  scene: "场景图",
  dimension: "尺寸信息图",
  marketing: "营销图",
  lifestyle: "场景图",
  detail: "细节图",
  infographic: "卖点信息图",
};

const state = {
  user: null,
  page: location.hash.replace("#", "") || "dashboard",
  data: null,
  credits: null,
  busy: false,
};

const h = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const money = (cents, currency = "usd") =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents || 0) / 100);

const activeProject = () => state.data?.projects?.[0] || null;
const currentPlan = () => state.data?.plans?.find((plan) => plan.id === state.user?.subscription?.plan);
const platformById = (id) => state.data?.platforms?.find((platform) => platform.id === id);
const invoiceForPayment = (paymentId) =>
  state.data?.invoices?.find((invoice) => invoice.paymentId === paymentId);
const promptEntries = (project) =>
  Object.entries(project.prompts || {}).map(([type, prompt]) => ({
    type,
    title: assetLabels[type] || type,
    prompt,
    ratio: platformById(project.platform)?.ratio || "1:1",
  }));

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.error || payload?.message || `请求失败：${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function navigate(page) {
  location.hash = page;
}

function setBusy(value) {
  state.busy = value;
  document.body.classList.toggle("is-busy", value);
}

async function refresh() {
  try {
    const [me, dashboard, credits] = await Promise.all([
      api("/api/auth/me"),
      api("/api/bootstrap"),
      api("/api/v2/credits/balance"),
    ]);
    state.user = me.user;
    state.data = dashboard;
    state.credits = credits.balance || credits;
    render();
  } catch (error) {
    state.user = null;
    renderAuth();
  }
}

function layout(content) {
  const nav = routes
    .map(
      (route) => `
        <a class="${state.page === route.hash ? "active" : ""}" href="#${route.hash}">
          ${route.label}
        </a>
      `,
    )
    .join("");

  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">SC</div>
        <div>
          <strong>SellerCanvas AI</strong>
          <span>跨境商品图与 Listing 交付平台</span>
        </div>
      </div>
      <nav class="nav-list">${nav}</nav>
      <div class="sidebar-card">
        <span>当前方案</span>
        <strong>${h(currentPlan()?.name || "Free")}</strong>
        <small>剩余积分：${h(state.credits?.balance ?? state.user?.credits ?? 0)}</small>
        <button class="ghost-button" data-action="go-billing">升级方案</button>
      </div>
    </aside>
    <main class="main-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">客户使用端</p>
          <h1>${pageTitle()}</h1>
        </div>
        <div class="topbar-actions">
          <span class="status-pill">已登录：${h(state.user?.name || state.user?.email)}</span>
          <button class="ghost-button" data-action="logout">退出</button>
        </div>
      </header>
      ${content}
    </main>
  `;
}

function pageTitle() {
  return routes.find((route) => route.hash === state.page)?.label || "工作台";
}

function renderAuth() {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-hero">
        <p class="eyebrow">SellerCanvas AI</p>
        <h1>让跨境卖家一键交付商品图和 Listing 文案</h1>
        <p>
          上传产品图后，系统会完成产品分析、导演级 Prompt 反推、平台适配、批量生图、
          文案生成、导出与历史追踪。客户只需要付费并消耗积分使用工具。
        </p>
        <div class="hero-stats">
          <span>Amazon</span>
          <span>Temu</span>
          <span>TikTok Shop</span>
          <span>Etsy</span>
        </div>
      </section>
      <section class="auth-card">
        <div class="tabs">
          <button class="active" data-auth-tab="login">登录</button>
          <button data-auth-tab="register">注册</button>
        </div>
        <form id="auth-form" data-mode="login">
          <label>邮箱<input name="email" type="email" value="demo@sellercanvas.ai" required /></label>
          <label>密码<input name="password" type="password" value="Demo123456" required /></label>
          <label class="register-only hidden">姓名<input name="name" value="Demo Seller" /></label>
          <button class="primary-button" type="submit">登录使用</button>
        </form>
        <button class="ghost-button full-width" data-action="oauth-google">使用 Google 登录</button>
        <p class="muted">本地演示账号：demo@sellercanvas.ai / Demo123456</p>
      </section>
    </main>
  `;
}

function render() {
  if (!state.user) {
    renderAuth();
    return;
  }

  const views = {
    dashboard: renderDashboard,
    projects: renderProjects,
    templates: renderTemplates,
    history: renderHistory,
    exports: renderExports,
    billing: renderBilling,
    settings: renderSettings,
  };

  layout((views[state.page] || renderDashboard)());
}

function renderDashboard() {
  const project = activeProject();
  return `
    <section class="metric-grid">
      <div class="metric-card">
        <span>剩余积分</span>
        <strong>${h(state.credits?.balance ?? state.user?.credits ?? 0)}</strong>
        <small>生图、文案和 API 调用都会记录用量</small>
      </div>
      <div class="metric-card">
        <span>当前方案</span>
        <strong>${h(currentPlan()?.name || "Free")}</strong>
        <small>${h(currentPlan()?.credits || 0)} 积分 / 月</small>
      </div>
      <div class="metric-card">
        <span>项目数量</span>
        <strong>${h(state.data?.projects?.length || 0)}</strong>
        <small>支持历史追踪与再次生成</small>
      </div>
      <div class="metric-card">
        <span>已生成素材</span>
        <strong>${h(project?.assets?.length || 0)}</strong>
        <small>可导出 ZIP 交付包</small>
      </div>
    </section>
    <section class="two-column">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">核心工作流</p>
            <h2>从上传产品图到导出交付</h2>
          </div>
          <button class="primary-button" data-action="create-project">新建项目</button>
        </div>
        ${project ? renderProjectWorkflow(project) : empty("还没有项目", "先创建一个项目，再上传产品图开始分析。")}
      </div>
      <aside class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">平台适配</p>
            <h2>可交付规格</h2>
          </div>
        </div>
        <div class="platform-list">
          ${(state.data?.platforms || [])
            .map(
              (platform) => `
                <div>
                  <strong>${h(platform.name)}</strong>
                  <span>${h(platform.ratio)} · ${h(platform.safeZone)} · ${h(platform.imageSize)}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </aside>
    </section>
  `;
}

function renderProjectWorkflow(project) {
  const platform = platformById(project.platform);
  return `
    <div class="project-head">
      <div>
        <h3>${h(project.name)}</h3>
        <p>${h(project.product?.category)} · ${h(platform?.name || project.platform)} · ${h(project.status)}</p>
      </div>
      <div class="button-row">
        <button class="ghost-button" data-action="analyze-project" data-id="${h(project.id)}">重新分析</button>
        <button class="primary-button" data-action="generate-assets" data-id="${h(project.id)}">批量生图</button>
      </div>
    </div>
    ${renderUpload(project)}
    ${renderAnalysis(project)}
    ${renderPromptCards(project)}
    ${renderAssets(project)}
    ${renderCopy(project)}
    ${renderProgress(project)}
  `;
}

function renderUpload(project) {
  return `
    <form class="upload-box" data-upload="${h(project.id)}">
      <input name="image" type="file" accept="image/*" />
      <div>
        <strong>${project.image ? "已上传产品图" : "上传产品图"}</strong>
        <span>支持手机随手拍、白底图、竞品截图。上传后会重新分析产品卖点和画面策略。</span>
      </div>
      <button class="ghost-button" type="submit">上传并分析</button>
    </form>
  `;
}

function renderAnalysis(project) {
  if (!project.analysis) {
    return empty("尚未完成分析", "点击“重新分析”后，系统会识别产品特征、买家心理和平台要求。");
  }

  const list = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return value ? [value] : [];
  };

  const sections = [
    ["产品识别", list(project.analysis.visualFacts)],
    ["买家心路", list(project.analysis.buyerMindMap)],
    ["优化风险", list(project.analysis.risks)],
    ["建议动作", list(project.analysis.recommendations)],
  ];

  return `
    <div class="analysis-grid">
      ${sections
        .map(
          ([title, items]) => `
            <div>
              <strong>${title}</strong>
              <ul>${(items || []).map((item) => `<li>${h(item)}</li>`).join("")}</ul>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderPromptCards(project) {
  const prompts = promptEntries(project);
  if (!prompts.length) return "";
  return `
    <div class="card-grid">
      ${prompts
        .map(
          (prompt) => `
            <article class="prompt-card">
              <div class="card-meta">${h(assetLabels[prompt.type] || prompt.type)} · ${h(prompt.ratio)}</div>
              <h3>${h(prompt.title)}</h3>
              <p>${h(prompt.prompt)}</p>
              <small>${h(prompt.negativePrompt || "")}</small>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderAssets(project) {
  if (!project.assets?.length) return "";
  return `
    <div class="asset-grid">
      ${project.assets
        .map(
          (asset) => `
            <article class="asset-card">
              <div class="asset-preview">${h(assetLabels[asset.type] || asset.type)}</div>
              <strong>${h(asset.label || asset.title)}</strong>
              <span>${h(asset.format || "svg")} · ${h(asset.provider || "local")}</span>
              <p>${h(asset.prompt || "已生成可交付素材。").slice(0, 140)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCopy(project) {
  if (!project.copy?.title) return "";
  return `
    <div class="copy-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Listing 文案</p>
          <h2>${h(project.copy.title)}</h2>
        </div>
        <button class="ghost-button" data-action="copy-listing" data-id="${h(project.id)}">复制文案</button>
      </div>
      <ul>${(project.copy.bullets || []).map((item) => `<li>${h(item)}</li>`).join("")}</ul>
      <p>${h(project.copy.description)}</p>
    </div>
  `;
}

function renderProgress(project) {
  const items = Array.isArray(project.timeline)
    ? project.timeline
    : [
        { title: "交付进度", detail: `${h(project.progress || 0)}%` },
        { title: "当前状态", detail: project.status || "draft" },
      ];
  return `
    <div class="timeline">
      ${items
        .map(
          (item) => `
            <div>
              <strong>${h(item.title || item.label || item.step)}</strong>
              <span>${h(item.detail || item.status || "")}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderProjects() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">项目管理</p>
          <h2>商品素材生产项目</h2>
        </div>
        <button class="primary-button" data-action="create-project">新建项目</button>
      </div>
      <div class="table-list">
        ${(state.data?.projects || [])
          .map(
            (project) => `
              <div class="row-card">
                <div>
                  <strong>${h(project.name)}</strong>
                  <span>${h(project.product?.category)} · ${h(platformById(project.platform)?.name || project.platform)}</span>
                </div>
                <div>
                  <span class="status-pill">${h(project.status)}</span>
                  <button class="ghost-button" data-action="open-project" data-id="${h(project.id)}">打开</button>
                  <button class="primary-button" data-action="generate-assets" data-id="${h(project.id)}">生成</button>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderTemplates() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">可复用模板</p>
          <h2>按平台和场景快速开始</h2>
        </div>
      </div>
      <div class="card-grid">
        ${(state.data?.templates || [])
          .map(
            (template) => `
              <article class="prompt-card">
                <div class="card-meta">${h(template.platform)} · ${h(template.category)}</div>
                <h3>${h(template.name)}</h3>
                <p>${h(template.description)}</p>
                <small>${(template.tags || []).map(h).join(" / ")}</small>
                <button class="ghost-button" data-action="use-template" data-id="${h(template.id)}">用此模板建项目</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderHistory() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">历史追踪</p>
          <h2>关键动作记录</h2>
        </div>
      </div>
      <div class="timeline">
        ${(state.data?.history || [])
          .map(
            (item) => `
              <div>
                <strong>${h(item.title)}</strong>
                <span>${h(item.detail)} · ${h(new Date(item.createdAt).toLocaleString("zh-CN"))}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderExports() {
  const exports = state.data?.exports || [];
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">交付导出</p>
          <h2>图片、Prompt 与 Listing 打包</h2>
        </div>
        <button class="primary-button" data-action="export-active">导出当前项目</button>
      </div>
      <div class="table-list">
        ${exports.length
          ? exports
              .map(
                (item) => `
                  <div class="row-card">
                    <div>
                      <strong>${h(item.projectName)}</strong>
                      <span>${h(item.format)} · ${h(item.assetCount)} 个素材</span>
                    </div>
                    <a class="ghost-button" href="${h(item.href || item.url)}" target="_blank" rel="noreferrer">下载</a>
                  </div>
                `,
              )
              .join("")
          : empty("暂无导出记录", "生成素材后可以导出交付包。")}
      </div>
    </section>
  `;
}

function renderBilling() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">订阅与积分</p>
          <h2>客户付费后按积分使用</h2>
        </div>
        <button class="ghost-button" data-action="manage-billing">管理订阅</button>
      </div>
      <div class="pricing-grid">
        ${(state.data?.plans || [])
          .map((plan) => {
            const active = plan.id === state.user?.subscription?.plan;
            return `
              <article class="pricing-card ${active ? "featured" : ""}">
                <span>${active ? "当前方案" : "可升级"}</span>
                <h3>${h(plan.name)}</h3>
                <strong>${plan.price ? money(plan.price * 100, plan.currency) : "免费"}</strong>
                <p>${h(plan.credits)} 积分 / 月</p>
                <ul>${(plan.features || []).map((item) => `<li>${h(item)}</li>`).join("")}</ul>
                <button
                  class="${active ? "ghost-button" : "primary-button"}"
                  ${active ? "disabled" : `data-action="checkout" data-plan="${h(plan.id)}"`}
                >
                  ${active ? "正在使用" : "立即升级"}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="table-list">
        ${(state.data?.payments || [])
          .map(
            (payment) => `
              <div class="row-card">
                <div>
                  <strong>${h(payment.planName)}</strong>
                  <span>${h(new Date(payment.createdAt).toLocaleString("zh-CN"))}</span>
                </div>
                <div>
                  <span>${money((payment.amount || 0) * 100, payment.currency)}</span>
                  <button class="ghost-button" data-action="download-invoice" data-id="${h(invoiceForPayment(payment.id)?.id || "")}" ${invoiceForPayment(payment.id) ? "" : "disabled"}>发票</button>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">账号信息</p>
          <h2>客户端只负责购买与使用</h2>
        </div>
      </div>
      <div class="settings-grid">
        <label>邮箱<input value="${h(state.user?.email)}" disabled /></label>
        <label>姓名<input value="${h(state.user?.name)}" disabled /></label>
        <label>方案<input value="${h(currentPlan()?.name || state.user?.subscription?.plan)}" disabled /></label>
        <label>积分<input value="${h(state.credits?.balance ?? state.user?.credits ?? 0)}" disabled /></label>
      </div>
      <p class="muted">API Provider、平台密钥和系统配置只在开发者后台维护，客户端不会暴露这些入口。</p>
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

async function createProjectFromPrompt(templateId) {
  const name = prompt("项目名称", "Amazon 爆款商品图项目");
  if (!name) return;

  const category = prompt("产品品类", "家居收纳");
  const platforms = state.data?.platforms || [];
  const platform = prompt(
    `目标平台：${platforms.map((item) => item.id).join(" / ")}`,
    "amazon",
  );

  const keywords = prompt("关键词，用逗号分隔", "便携, 高级感, 送礼");

  const payload = {
    name,
    platform: platform || "amazon",
    product: {
      category: category || "未分类商品",
      points: (keywords || "")
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    },
    templateId,
  };

  await api("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  toast("项目已创建");
  state.page = "dashboard";
  location.hash = "dashboard";
  await refresh();
}

async function handleAction(action, target) {
  if (state.busy) return;

  const id = target.dataset.id;
  try {
    setBusy(true);
    if (action === "logout") {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      state.user = null;
      renderAuth();
      return;
    }
    if (action === "go-billing") {
      navigate("billing");
      return;
    }
    if (action === "oauth-google") {
      const result = await api("/api/auth/oauth/google/start");
      if (result.authorizationUrl) {
        location.href = result.authorizationUrl;
        return;
      }
      toast(result.message || "Google OAuth 尚未配置，请先在环境变量里配置客户端信息");
      return;
    }
    if (action === "create-project") {
      await createProjectFromPrompt();
      return;
    }
    if (action === "use-template") {
      await createProjectFromPrompt(id);
      return;
    }
    if (action === "open-project") {
      const index = state.data.projects.findIndex((project) => project.id === id);
      if (index > 0) {
        const [project] = state.data.projects.splice(index, 1);
        state.data.projects.unshift(project);
      }
      navigate("dashboard");
      return;
    }
    if (action === "analyze-project") {
      await api(`/api/projects/${id}/analyze`, { method: "POST" });
      toast("分析已更新");
      await refresh();
      return;
    }
    if (action === "generate-assets") {
      await api(`/api/projects/${id}/generate`, { method: "POST" });
      toast("素材和 Listing 已生成");
      await refresh();
      return;
    }
    if (action === "copy-listing") {
      const result = await api(`/api/projects/${id}/copy`, { method: "POST" });
      await navigator.clipboard?.writeText(result.text || "");
      toast("Listing 文案已复制");
      return;
    }
    if (action === "export-active") {
      const project = activeProject();
      if (!project) throw new Error("请先创建项目");
      await api(`/api/projects/${project.id}/export`, { method: "POST" });
      toast("交付包已生成");
      await refresh();
      return;
    }
    if (action === "checkout") {
      const planId = target.dataset.plan;
      const checkout = await api("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: planId }),
      });
      if (checkout.mode === "stripe" && checkout.checkoutUrl) {
        location.href = checkout.checkoutUrl;
        return;
      }
      await api("/api/billing/confirm", {
        method: "POST",
        body: JSON.stringify({ paymentId: checkout.payment.id }),
      });
      toast("订阅已生效，积分已入账");
      await refresh();
      return;
    }
    if (action === "manage-billing") {
      const result = await api("/api/billing/manage", { method: "POST" });
      toast(result.message || "已进入订阅管理");
      return;
    }
    if (action === "download-invoice") {
      if (!id) throw new Error("该订单还没有发票");
      window.open(`/api/invoices/${id}/download`, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setBusy(false);
  }
}

app.addEventListener("click", (event) => {
  const authTab = event.target.closest("[data-auth-tab]");
  if (authTab) {
    const mode = authTab.dataset.authTab;
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === mode);
    });
    const form = document.querySelector("#auth-form");
    form.dataset.mode = mode;
    form.querySelector("button[type='submit']").textContent = mode === "login" ? "登录使用" : "创建账号";
    form.querySelector(".register-only").classList.toggle("hidden", mode !== "register");
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    event.preventDefault();
    handleAction(actionTarget.dataset.action, actionTarget);
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();

  const authForm = event.target.closest("#auth-form");
  if (authForm) {
    const data = Object.fromEntries(new FormData(authForm));
    const mode = authForm.dataset.mode || "login";
    try {
      const result = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      state.user = result.user;
      toast(mode === "login" ? "登录成功" : "注册成功");
      await refresh();
    } catch (error) {
      toast(error.message, "error");
    }
    return;
  }

  const uploadForm = event.target.closest("[data-upload]");
  if (uploadForm) {
    const file = uploadForm.querySelector("input[type='file']").files[0];
    if (!file) {
      toast("请选择产品图片", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api(`/api/projects/${uploadForm.dataset.upload}/upload-image`, {
          method: "POST",
          body: JSON.stringify({ name: file.name, image: reader.result }),
        });
        toast("图片已上传并完成分析");
        await refresh();
      } catch (error) {
        toast(error.message, "error");
      }
    };
    reader.readAsDataURL(file);
  }
});

window.addEventListener("hashchange", () => {
  state.page = location.hash.replace("#", "") || "dashboard";
  render();
});

refresh();
