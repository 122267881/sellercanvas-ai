const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  db: null,
  route: location.hash.replace("#/", "") || "dashboard",
  selectedProjectId: null,
  busy: false,
  credits: null
};

const routes = [
  { id: "dashboard", label: "工作台" },
  { id: "projects", label: "项目" },
  { id: "templates", label: "模板" },
  { id: "history", label: "生成历史" },
  { id: "exports", label: "导出中心" },
  { id: "billing", label: "账单" },
  { id: "pricing", label: "定价" }
];

const assetLabels = {
  main: "主图",
  scene: "场景图",
  dimension: "尺寸图",
  marketing: "营销图"
};

function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function activeProject() {
  if (!state.db?.projects?.length) return null;
  return state.db.projects.find((project) => project.id === state.selectedProjectId) || state.db.projects[0];
}

function platformById(id) {
  return state.db.platforms.find((platform) => platform.id === id) || state.db.platforms[0];
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
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

async function loadCredits() {
  if (!state.db?.auth?.user) {
    state.credits = null;
    return;
  }
  try {
    const result = await api("/api/v2/credits/balance");
    state.credits = result.balance;
  } catch (error) {
    state.credits = null;
  }
}

async function load() {
  state.db = await api("/api/bootstrap");
  await loadCredits();
  state.selectedProjectId = localStorage.getItem("sellercanvas-active-project") || state.db.projects[0]?.id || null;
  render();
}

async function refresh(message) {
  state.db = await api("/api/bootstrap");
  await loadCredits();
  if (message) showToast(message);
  render();
}

function shell(content) {
  const project = activeProject();
  const user = state.db.auth?.user;
  return `
    <header class="topbar">
      <a class="brand" href="#/dashboard">
        <span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Zm0 4L7 8.8v5.8l5 2.8 5-2.8V8.8L12 6Z"/></svg></span>
        <span>SellerCanvas AI</span>
      </a>
      <nav class="nav-tabs">
        ${routes.map((route) => `<a class="${state.route === route.id ? "is-active" : ""}" href="#/${route.id}">${route.label}</a>`).join("")}
      </nav>
      <div class="top-actions">
        ${user ? `<button class="secondary-btn" data-route="billing" title="当前可用积分">积分 ${h(state.credits?.available ?? 0)}</button>` : ""}
        <button class="avatar" title="${h(user?.email || "SellerCanvas")}">${h((user?.name || "SC").slice(0, 2).toUpperCase())}</button>
        ${user ? `<button class="secondary-btn" data-action="logout">退出</button>` : `<button class="secondary-btn" data-route="login">登录</button>`}
        ${user ? `<button class="primary-action" data-action="new-project"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>新建项目</button>` : ""}
      </div>
    </header>
    <main class="product-shell">
      <aside class="side-rail">
        <div class="panel-title">当前项目</div>
        ${project ? `
          <div class="current-project">
            <strong>${h(project.name)}</strong>
            <span>${h(platformById(project.platform).name)} · ${project.progress}%</span>
          </div>
          <div class="mini-progress"><span style="width:${project.progress}%"></span></div>
        ` : `<p class="muted">暂无项目</p>`}
        <div class="panel-title small">快速入口</div>
        <button data-route="dashboard">商品工作台</button>
        <button data-route="templates">套用模板</button>
        <button data-route="exports">查看导出</button>
        <button data-route="billing">订阅账单</button>
      </aside>
      <section class="product-main">${content}</section>
    </main>
  `;
}

function render() {
  if (!state.db) {
    app.innerHTML = `<div class="boot-screen"><strong>SellerCanvas AI</strong><span>正在加载工作区</span></div>`;
    return;
  }
  if (["login", "register"].includes(state.route)) {
    app.innerHTML = authShell(state.route === "register" ? registerPage() : loginPage());
    bindPageEvents();
    return;
  }
  const publicRoutes = ["pricing"];
  if (!state.db.auth?.user && !publicRoutes.includes(state.route)) {
    app.innerHTML = authShell(loginPage());
    bindPageEvents();
    return;
  }
  const pages = {
    dashboard: dashboardPage,
    projects: projectsPage,
    templates: templatesPage,
    history: historyPage,
    exports: exportsPage,
    billing: billingPage,
    pricing: pricingPage
  };
  app.innerHTML = shell((pages[state.route] || dashboardPage)());
  bindPageEvents();
}

function authShell(content) {
  return `
    <main class="auth-page">
      <section class="auth-card">
        <a class="brand" href="#/login"><span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Zm0 4L7 8.8v5.8l5 2.8 5-2.8V8.8L12 6Z"/></svg></span><span>SellerCanvas AI</span></a>
        ${content}
      </section>
    </main>
  `;
}

function loginPage() {
  return `
    <div class="auth-head"><h1>登录工作区</h1><p>登录后使用商品生图、订阅和导出功能。</p></div>
    <form class="auth-form" data-form="login">
      <label>邮箱<input name="email" type="email" placeholder="you@example.com" required></label>
      <label>密码<input name="password" type="password" placeholder="请输入密码" required></label>
      <button class="generate-btn" data-action="login" type="button">登录</button>
      <button class="secondary-btn" data-action="oauth-start" data-provider="google" type="button">使用 Google 登录</button>
      <button class="secondary-btn" data-action="oauth-start" data-provider="github" type="button">使用 GitHub 登录</button>
    </form>
    <p class="auth-switch">没有账号？<a href="#/register">注册</a></p>
  `;
}

function registerPage() {
  return `
    <div class="auth-head"><h1>创建账号</h1><p>开始试用，注册后获得 50 积分。</p></div>
    <form class="auth-form" data-form="register">
      <label>姓名<input name="name" required></label>
      <label>邮箱<input name="email" type="email" required></label>
      <label>密码<input name="password" type="password" minlength="8" required></label>
      <button class="generate-btn" data-action="register" type="button">注册并进入</button>
    </form>
    <p class="auth-switch">已有账号？<a href="#/login">登录</a></p>
  `;
}

function dashboardPage() {
  const project = activeProject();
  if (!project) return emptyPage("还没有项目", "点击新建项目，或从模板创建一个 Listing Kit。");
  const platform = platformById(project.platform);
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">跨境 AI 商品图与 Listing 交付平台</p>
        <h1>${h(project.name)}</h1>
        <p class="subhead">${h(platform.name)} · ${h(platform.rule)}</p>
      </div>
      <div class="head-actions">
        <button class="generate-btn" data-action="export-project" data-id="${project.id}">导出 Listing Pack · 2积分</button>
      </div>
    </div>
    <div class="work-grid">
      <section class="panel">
        <div class="section-head"><h2>A. 商品信息</h2><span class="status-pill">${h(project.status)}</span></div>
        <div class="upload-layout">
          <label class="dropzone">
            <input type="file" accept="image/png,image/jpeg,image/webp" data-action="upload-image" data-id="${project.id}">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            <strong>上传商品图</strong>
            <span>JPG / PNG / WEBP</span>
          </label>
          <div class="product-preview"><img src="${project.image}" alt="商品图"></div>
          <form class="form-grid" data-form="project" data-id="${project.id}">
            <label>项目名称<input name="name" value="${h(project.name)}"></label>
            <label>商品名称<input name="product.name" value="${h(project.product.name)}"></label>
            <label>品类<input name="product.category" value="${h(project.product.category)}"></label>
            <label>材质<input name="product.material" value="${h(project.product.material)}"></label>
            <label>目标平台<select name="platform">${state.db.platforms.map((item) => `<option value="${item.id}" ${project.platform === item.id ? "selected" : ""}>${h(item.name)}</option>`).join("")}</select></label>
            <label>视觉风格<input name="product.style" value="${h(project.product.style)}"></label>
            <label class="span-2">核心卖点<textarea name="product.points">${h(project.product.points.join(", "))}</textarea></label>
          </form>
        </div>
        <div class="panel-actions">
          <button class="secondary-btn" data-action="save-project" data-id="${project.id}">保存项目</button>
          <button class="generate-btn" data-action="analyze-project" data-id="${project.id}">AI 商品分析 · 5积分</button>
        </div>
      </section>
      <section class="panel">
        <div class="section-head"><h2>B. AI 分析结果</h2></div>
        ${analysisBlock(project)}
      </section>
      <section class="panel">
        <div class="section-head"><h2>C. 图片方案</h2></div>
        ${aiPlanPreview(project)}
        <div class="panel-actions">
          <button class="generate-btn" data-action="generate-assets" data-id="${project.id}">生成 4 张商品图 · 80积分</button>
        </div>
      </section>
      <section class="panel">
        <div class="section-head"><h2>D. 生成资产</h2></div>
        ${assetsGrid(project)}
      </section>
      <section class="panel">
        <div class="section-head"><h2>E. Listing 文案</h2></div>
        ${copyEditor(project)}
        <div class="panel-actions">
          <button class="secondary-btn" data-action="rewrite-copy" data-id="${project.id}">重新生成文案 · 3积分</button>
          <button class="secondary-btn" data-action="copy-listing" data-id="${project.id}">复制 Listing</button>
          <button class="generate-btn" data-action="save-copy" data-id="${project.id}">保存文案</button>
        </div>
      </section>
      <section class="panel">
        <div class="section-head"><h2>项目进度</h2></div>
        ${progressBlock(project)}
      </section>
    </div>
  `;
}

function analysisBlock(project) {
  if (!project.analysis) return `<div class="empty-card">还未分析。点击“AI 商品分析”后，会生成品类、材质、买家意图、合规风险和优化建议。</div>`;
  const mind = project.analysis.buyerMindMap || {};
  const aida = project.analysis.aidaFab || {};
  const quality = project.analysis.qualityGate || {};
  return `
    <div class="kv-list">
      <div><span>品类</span><b>${h(project.analysis.category)}</b></div>
      <div><span>材质</span><b>${h(project.analysis.material)}</b></div>
      <div><span>置信度</span><b>${Math.round((project.analysis.confidence || 0) * 100)}%</b></div>
    </div>
    ${project.analysis.reversePromptBasis ? `
      <div class="insight-grid">
        <article>
          <strong>Prompt 反推依据</strong>
          <p>主体：${h(project.analysis.reversePromptBasis.subject)}</p>
          <p>质感：${h(project.analysis.reversePromptBasis.materialTexture)}</p>
          <p>结构：${h(project.analysis.reversePromptBasis.shapeStructure)}</p>
          <p>镜头：${h(project.analysis.reversePromptBasis.cameraAngle)}</p>
          <p>光线：${h(project.analysis.reversePromptBasis.lighting)}</p>
        </article>
      </div>
    ` : ""}
    <div class="director-grid">
      <article>
        <strong>买家心路地图</strong>
        <p><b>第一眼：</b>${h(mind.firstGlance)}</p>
        <p><b>第二眼：</b>${h(mind.secondGlance)}</p>
        <p><b>信任建立：</b>${h(mind.trustBuilder)}</p>
        <p><b>欲望触发：</b>${h(mind.desireTrigger)}</p>
        <p><b>行动暗示：</b>${h(mind.actionCue)}</p>
      </article>
      <article>
        <strong>AIDA / FAB 转化逻辑</strong>
        <p><b>A：</b>${h(aida.attention)}</p>
        <p><b>I：</b>${h(aida.interest)}</p>
        <p><b>D：</b>${h(aida.desire)}</p>
        <p><b>A：</b>${h(aida.action)}</p>
        ${(aida.fab || []).slice(0, 3).map((item) => `<p><b>FAB：</b>${h(item.feature)} 到 ${h(item.advantage)} 到 ${h(item.benefit)}</p>`).join("")}
      </article>
      <article>
        <strong>视觉质检</strong>
        <p><b>分数：</b>${quality.score || 0}/100 · ${h(quality.verdict || "待生成")}</p>
        <p>${h(quality.directorNote || "等待生成后质检。")}</p>
        ${(quality.checks || []).map((item) => `<p>${item.passed ? "通过" : "待优化"}：${h(item.name)}</p>`).join("")}
      </article>
    </div>
    <div class="insight-grid">
      ${["buyerIntent", "risks", "recommendations"].map((key) => `
        <article>
          <strong>${key === "buyerIntent" ? "买家意图" : key === "risks" ? "合规风险" : "优化建议"}</strong>
          ${(project.analysis[key] || []).map((item) => `<p>${h(item)}</p>`).join("")}
        </article>
      `).join("")}
    </div>
  `;
}

function aiPlanPreview(project) {
  const prompts = project.prompts || {};
  const fallback = {
    main: "清晰主图，突出商品轮廓和材质质感。",
    scene: "生活场景图，让买家理解使用后的价值。",
    dimension: "尺寸说明图，减少购买前疑虑。",
    marketing: "营销卖点图，强化转化理由。"
  };
  return `<div class="ai-plan-grid">
    ${Object.keys(assetLabels).map((key) => `
      <article>
        <strong>${assetLabels[key]}</strong>
        <p>${h(summarizePlan(prompts[key] || fallback[key]))}</p>
      </article>
    `).join("")}
  </div>`;
}

function summarizePlan(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;
}

function assetsGrid(project) {
  if (!project.assets?.length) return `<div class="empty-card">还没有生成资产。生成后会出现主图、场景图、尺寸图和营销图。</div>`;
  return `<div class="asset-grid product-assets">
    ${project.assets.map((asset) => `
      <article class="asset-card">
        <header><strong>${h(asset.label)}</strong><a download="${h(project.name)}-${asset.type}.svg" href="${asset.dataUrl}">下载</a></header>
        <div class="asset-media"><img src="${asset.dataUrl}" alt="${h(asset.label)}"></div>
        <footer>${h(asset.provider || "local")}</footer>
      </article>
    `).join("")}
  </div>`;
}

function copyEditor(project) {
  const copy = project.copy || { title: "", bullets: [], description: "" };
  return `<div class="copy-editor">
    <label>标题<input data-copy="title" value="${h(copy.title)}"></label>
    <label>五点描述<textarea data-copy="bullets">${h((copy.bullets || []).join("\n"))}</textarea></label>
    <label>详情描述<textarea data-copy="description">${h(copy.description || "")}</textarea></label>
  </div>`;
}

function progressBlock(project) {
  return `
    <div class="progress-wrap">
      <div class="ring" style="--value:${project.progress}"><span>${project.progress}%</span><small>${project.progress === 100 ? "已完成" : "进行中"}</small></div>
      <ul class="check-list">
        ${[
          ["商品图", project.image],
          ["基础信息", project.product.name && project.product.category],
          ["AI 分析", project.analysis],
          ["Prompt", Object.keys(project.prompts || {}).length],
          ["AI 生图", project.assets?.length],
          ["Listing 文案", project.copy?.title],
          ["导出交付", project.status === "exported"]
        ].map(([label, done]) => `<li class="${done ? "is-done" : ""}"><span class="check-dot"></span><span>${label}</span><span>${done ? "完成" : "待处理"}</span></li>`).join("")}
      </ul>
    </div>
  `;
}

function projectsPage() {
  return `
    <div class="page-head"><div><h1>项目</h1><p class="subhead">管理所有商品 Listing Kit。</p></div><button class="primary-action" data-action="new-project">新建项目</button></div>
    <div class="table-card">
      ${state.db.projects.map((project) => `
        <article class="row-card">
          <div><strong>${h(project.name)}</strong><span>${h(project.product.category)} · ${h(platformById(project.platform).name)}</span></div>
          <div class="mini-progress"><span style="width:${project.progress}%"></span></div>
          <b>${project.progress}%</b>
          <button data-action="open-project" data-id="${project.id}">打开</button>
          <button data-action="duplicate-project" data-id="${project.id}">复制</button>
          <button data-action="delete-project" data-id="${project.id}">删除</button>
        </article>
      `).join("") || `<div class="empty-card">暂无项目</div>`}
    </div>
  `;
}

function templatesPage() {
  return `
    <div class="page-head"><div><h1>模板中心</h1><p class="subhead">从成熟类目模板开始，直接进入可编辑项目。</p></div></div>
    <div class="card-grid">
      ${state.db.templates.map((template) => `
        <article class="template-card">
          <span class="status-pill">${h(platformById(template.platform).name)}</span>
          <h2>${h(template.name)}</h2>
          <p>${h(template.productName)}</p>
          <div class="tag-row">${template.tags.map((tag) => `<span>${h(tag)}</span>`).join("")}</div>
          <button class="generate-btn" data-action="use-template" data-id="${template.id}">使用模板</button>
        </article>
      `).join("")}
    </div>
  `;
}

function historyPage() {
  return `
    <div class="page-head"><div><h1>生成历史</h1><p class="subhead">所有分析、生成、导出操作都会记录。</p></div></div>
    <div class="timeline">
      ${state.db.history.map((item) => `<article><span>${h(item.type)}</span><strong>${h(item.title)}</strong><p>${h(item.detail)}</p><small>${new Date(item.createdAt).toLocaleString()}</small></article>`).join("") || `<div class="empty-card">暂无历史</div>`}
    </div>
  `;
}

function exportsPage() {
  return `
    <div class="page-head"><div><h1>导出中心</h1><p class="subhead">下载历史 Listing Pack。</p></div></div>
    <div class="table-card">
      ${state.db.exports.map((item) => `<article class="row-card"><div><strong>${h(item.name)}</strong><span>${item.assetCount} 个资产 · ${new Date(item.createdAt).toLocaleString()}</span></div><a class="secondary-btn" href="${item.href}" download>下载</a></article>`).join("") || `<div class="empty-card">暂无导出。请先在工作台导出项目。</div>`}
    </div>
  `;
}

function billingPage() {
  const user = state.db.auth?.user;
  const sub = user?.subscription || {};
  return `
    <div class="page-head">
      <div><h1>订阅与账单</h1><p class="subhead">当前订阅：${h(sub.plan || "free")} · ${h(sub.status || "inactive")} · 可用积分 ${h(state.credits?.available ?? 0)}</p></div>
      <button class="secondary-btn" data-action="manage-billing">管理订阅</button>
    </div>
    <div class="card-grid">
      ${(state.db.plans || []).map((plan) => planCard(plan, sub, "立即升级")).join("")}
    </div>
    <section class="panel">
      <div class="section-head"><h2>支付记录与发票</h2><button class="secondary-btn" data-action="cancel-subscription">取消订阅</button></div>
      <div class="table-card">
        ${(state.db.invoices || []).map((invoice) => `<article class="row-card"><div><strong>${h(invoice.plan)}</strong><span>${h(invoice.status)} · ${new Date(invoice.createdAt).toLocaleString()}</span></div><b>${invoice.amount} ${h(invoice.currency || "USD")}</b><button data-action="download-invoice" data-id="${invoice.id}">查看账单</button></article>`).join("") || `<div class="empty-card">暂无发票。</div>`}
      </div>
    </section>
  `;
}

function pricingPage() {
  const plans = state.db.plans || [];
  const sub = state.db.auth?.user?.subscription || {};
  return `
    <div class="page-head"><div><h1>定价</h1><p class="subhead">选择适合当前业务阶段的积分套餐。</p></div></div>
    <div class="card-grid">
      ${plans.map((plan) => planCard(plan, sub, "立即订阅")).join("")}
    </div>
  `;
}

function planCard(plan, sub, actionLabel) {
  return `
    <article class="template-card ${sub.plan === plan.id ? "is-selected" : ""}">
      <h2>${h(plan.name)}</h2>
      <p>每月 ${h(plan.credits)} 积分</p>
      <strong class="price">$${plan.price}/mo</strong>
      <div class="tag-row">${planFeatures(plan).map((item) => `<span>${h(item)}</span>`).join("")}</div>
      <button class="generate-btn" data-action="checkout" data-plan="${plan.id}">${sub.plan === plan.id ? "当前方案" : actionLabel}</button>
    </article>
  `;
}

function planFeatures(plan) {
  return (plan.features || []).map((feature) => {
    const creditMatch = String(feature).match(/^(\d+)\s+credits\s+\/\s+month$/i);
    if (creditMatch) return `每月 ${creditMatch[1]} 积分`;
    return feature;
  });
}

function emptyPage(title, body) {
  return `<div class="empty-page"><h1>${h(title)}</h1><p>${h(body)}</p><button class="primary-action" data-action="new-project">新建项目</button></div>`;
}

function bindPageEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `#/${button.dataset.route}`;
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    if (button.dataset.action === "upload-image") {
      button.addEventListener("change", handleUpload);
    } else {
      button.addEventListener("click", handleAction);
    }
  });
}

async function handleAction(event) {
  const el = event.currentTarget;
  const action = el.dataset.action;
  const id = el.dataset.id;
  try {
    if (action === "login") return login();
    if (action === "register") return register();
    if (action === "logout") return logout();
    if (action === "oauth-start") return oauthStart(el.dataset.provider);
    if (action === "new-project") return createProject();
    if (action === "open-project") {
      state.selectedProjectId = id;
      localStorage.setItem("sellercanvas-active-project", id);
      location.hash = "#/dashboard";
      render();
      return;
    }
    if (action === "save-project") return saveProject(id);
    if (action === "delete-project") return deleteProject(id);
    if (action === "duplicate-project") return mutate(`/api/projects/${id}/duplicate`, {}, "项目已复制");
    if (action === "analyze-project") return mutate(`/api/projects/${id}/analyze`, {}, "AI 分析完成");
    if (action === "generate-assets") return mutate(`/api/projects/${id}/generate`, {}, "4 张商品图已生成");
    if (action === "rewrite-copy") return mutate(`/api/projects/${id}/copy`, { copy: null }, "Listing 文案已重写");
    if (action === "save-copy") return saveCopy(id);
    if (action === "copy-listing") return copyListing(id);
    if (action === "export-project") return mutate(`/api/projects/${id}/export`, {}, "Listing Pack 已导出");
    if (action === "use-template") return useTemplate(id);
    if (action === "checkout") return checkout(el.dataset.plan);
    if (action === "manage-billing") return manageBilling();
    if (action === "cancel-subscription") return cancelSubscription();
    if (action === "download-invoice") return showToast("发票已在账单记录中，后续可接入 PDF 模板导出。");
  } catch (error) {
    showToast(error.message);
  }
}

async function login() {
  const data = Object.fromEntries(new FormData(document.querySelector("[data-form='login']")).entries());
  await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
  state.route = "dashboard";
  location.hash = "#/dashboard";
  await refresh("登录成功");
}

async function register() {
  const data = Object.fromEntries(new FormData(document.querySelector("[data-form='register']")).entries());
  await api("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
  state.route = "dashboard";
  location.hash = "#/dashboard";
  await refresh("注册成功，已赠送 50 积分");
}

async function logout() {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  localStorage.removeItem("sellercanvas-active-project");
  state.selectedProjectId = null;
  state.route = "login";
  location.hash = "#/login";
  await refresh("已退出");
}

async function oauthStart(provider) {
  const result = await api(`/api/auth/oauth/${provider}/start`);
  if (result.authorizationUrl) {
    location.href = result.authorizationUrl;
    return;
  }
  showToast(result.message);
}

async function mutate(path, body, message) {
  await api(path, { method: "POST", body: JSON.stringify(body) });
  await refresh(message);
}

async function createProject() {
  const name = prompt("项目名称", "New Listing Kit");
  if (!name) return;
  const payload = await api("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
  state.selectedProjectId = payload.project.id;
  localStorage.setItem("sellercanvas-active-project", payload.project.id);
  location.hash = "#/dashboard";
  await refresh("项目已创建");
}

async function useTemplate(templateId) {
  const payload = await api(`/api/templates/${templateId}/use`, { method: "POST", body: "{}" });
  state.selectedProjectId = payload.project.id;
  localStorage.setItem("sellercanvas-active-project", payload.project.id);
  location.hash = "#/dashboard";
  await refresh("已从模板创建项目");
}

async function deleteProject(projectId) {
  if (!confirm("确定删除这个项目吗？")) return;
  await api(`/api/projects/${projectId}`, { method: "DELETE" });
  state.selectedProjectId = null;
  localStorage.removeItem("sellercanvas-active-project");
  await refresh("项目已删除");
}

async function saveProject(projectId) {
  const form = document.querySelector(`[data-form="project"][data-id="${projectId}"]`);
  const data = new FormData(form);
  const project = activeProject();
  const next = structuredClone(project);
  next.name = data.get("name");
  next.platform = data.get("platform");
  next.product.name = data.get("product.name");
  next.product.category = data.get("product.category");
  next.product.material = data.get("product.material");
  next.product.style = data.get("product.style");
  next.product.points = String(data.get("product.points") || "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  await api(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify({ project: next }) });
  await refresh("项目已保存");
}

async function saveCopy(projectId) {
  const copy = {
    title: document.querySelector("[data-copy='title']").value,
    bullets: document.querySelector("[data-copy='bullets']").value.split(/\n/).map((item) => item.trim()).filter(Boolean),
    description: document.querySelector("[data-copy='description']").value
  };
  await api(`/api/projects/${projectId}/copy`, { method: "POST", body: JSON.stringify({ copy }) });
  await refresh("Listing 文案已保存");
}

async function copyListing(projectId) {
  const project = state.db.projects.find((item) => item.id === projectId);
  if (!project?.copy?.title) {
    showToast("请先生成或填写 Listing 文案");
    return;
  }
  const text = `${project.copy.title}\n\n${(project.copy.bullets || []).map((item) => `- ${item}`).join("\n")}\n\n${project.copy.description || ""}`;
  await navigator.clipboard.writeText(text);
  showToast("Listing 已复制");
}

async function handleUpload(event) {
  const file = event.target.files[0];
  const projectId = event.target.dataset.id;
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    showToast("请上传 JPG、PNG 或 WEBP");
    return;
  }
  const image = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  await api(`/api/projects/${projectId}/upload-image`, { method: "POST", body: JSON.stringify({ image, name: file.name }) });
  await refresh("商品图已上传");
}

async function checkout(plan) {
  const result = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan, provider: "stripe" }) });
  if (result.mode === "stripe" && result.checkoutUrl) {
    location.href = result.checkoutUrl;
    return;
  }
  await api("/api/billing/confirm", { method: "POST", body: JSON.stringify({ paymentId: result.payment.id }) });
  await refresh("测试支付已确认，订阅和积分已更新");
}

async function manageBilling() {
  const result = await api("/api/billing/manage", { method: "POST", body: "{}" });
  showToast(result.message);
}

async function cancelSubscription() {
  if (!confirm("确定取消当前订阅吗？")) return;
  await api("/api/subscription/cancel", { method: "POST", body: "{}" });
  await refresh("订阅已取消");
}

window.addEventListener("hashchange", () => {
  state.route = location.hash.replace("#/", "") || "dashboard";
  render();
});

load().catch((error) => {
  app.innerHTML = `<div class="empty-page"><h1>应用启动失败</h1><p>${h(error.message)}</p><button onclick="location.reload()">重新加载</button></div>`;
});
