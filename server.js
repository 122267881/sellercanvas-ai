const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { ApiError, createApiV2HttpHandler, createAppContext } = require("./apps/api/src");
const { JOB_TYPES } = require("./workers/ai/src/jobTypes");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(root, "data");
const exportDir = path.join(root, "exports");
const dbFile = path.join(dataDir, "db.json");
const sessionCookie = "sc_session";
const rateBuckets = new Map();
const apiV2Context = createAppContext();
const apiV2Handler = createApiV2HttpHandler({
  context: apiV2Context,
  authenticate: async (req) => {
    const db = await loadDb();
    return currentUser(db, req);
  },
  isInternal: (req) => {
    const configured = process.env.WORKER_INTERNAL_SECRET || "dev-worker-internal-secret";
    return Boolean(req.headers["x-worker-secret"] && req.headers["x-worker-secret"] === configured);
  }
});

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const platforms = [
  { id: "amazon", name: "Amazon", logo: "a", size: "2000 x 2000", ratio: "1:1", rule: "主图白底，主体占比 85%，不放水印、边框和夸张促销文字", compliance: ["white-background", "no-watermark", "main-product-only"] },
  { id: "temu", name: "Temu", logo: "T", size: "1600 x 1600", ratio: "1:1", rule: "强卖点、强对比、移动端首屏可读，适合活动流量位", compliance: ["mobile-readable", "benefit-first", "high-contrast"] },
  { id: "tiktok", name: "TikTok Shop", logo: "♪", size: "1080 x 1350", ratio: "4:5", rule: "场景感强，封面式构图，前三秒能看懂使用场景", compliance: ["lifestyle", "creator-cover", "vertical-ready"] },
  { id: "etsy", name: "Etsy", logo: "E", size: "2000 x 2000", ratio: "1:1", rule: "自然光、生活方式、手作或家居质感，强调独特性", compliance: ["natural-light", "handmade-feel", "lifestyle"] }
];

const assetTypes = [
  { id: "main", label: "主图", purpose: "搜索和详情页首图", color: "#f8fafc" },
  { id: "scene", label: "场景图", purpose: "提升代入感", color: "#fff3e8" },
  { id: "dimension", label: "尺寸图", purpose: "降低售前疑问", color: "#f4f9ff" },
  { id: "marketing", label: "营销图", purpose: "突出卖点和对比", color: "#ecfdf3" }
];

const directorDoctrine = {
  role: "全球顶尖视觉营销导演 + 跨境电商资深操盘手 + 顶级品牌策划人",
  mission: "让不会设计、不会写提示词、不会 PS 的跨境卖家，也能一键生成高质量、平台适配、可直接用于 Listing 的商品图和营销文案。",
  principles: [
    "导演思维：不是描述图片，而是导演一场让买家瞬间心动的视觉电影。",
    "AIDA：每张图必须完成注意、兴趣、欲望、行动的转化路径。",
    "FAB：每个视觉卖点都要从特征、优势落到买家利益。",
    "买家心路地图：先模拟买家第一眼、第二眼、信任建立、代入使用、按下购买键的心理过程。",
    "审美决策权交给买家：只使用能提升点击率和转化率的视觉元素组合。"
  ],
  promptLayers: [
    "产品角色与品牌调性",
    "场景叙事",
    "视觉冲击要素",
    "平台适配参数",
    "情感触发点",
    "负面约束与合规边界"
  ],
  qualityGate: [
    "构图是否在 1 秒内抓住视线",
    "材质是否真实到让买家想触摸",
    "场景是否让买家代入更好的生活",
    "卖点是否通过画面自然显现",
    "平台规则是否可直接用于 Listing",
    "是否避免夸张、虚假、绝对化和侵权表达"
  ]
};

const templates = [
  {
    id: "tpl-kitchen-rack",
    name: "厨房收纳架 Listing Kit",
    category: "Home & Kitchen",
    platform: "amazon",
    productName: "Stainless Steel Expandable Kitchen Storage Rack",
    material: "Stainless Steel",
    style: "Minimal / Modern",
    points: ["Rustproof", "Waterproof", "Expandable", "Space saving", "Easy to assemble"],
    tags: ["主图", "尺寸图", "收纳"]
  },
  {
    id: "tpl-pet-bowl",
    name: "宠物折叠碗 Launch Pack",
    category: "Pet Supplies",
    platform: "tiktok",
    productName: "Portable Silicone Pet Travel Bowl",
    material: "Food-grade Silicone",
    style: "Outdoor Lifestyle",
    points: ["Foldable", "Lightweight", "Easy to clean", "Travel friendly", "Leak resistant"],
    tags: ["TikTok", "场景图", "户外"]
  },
  {
    id: "tpl-desk-lamp",
    name: "家用台灯 Premium Pack",
    category: "Home Lighting",
    platform: "etsy",
    productName: "Dimmable LED Wooden Desk Lamp",
    material: "Natural Wood and Aluminum",
    style: "Natural Home",
    points: ["Dimmable", "Eye caring", "Warm ambience", "USB powered", "Space saving"],
    tags: ["Etsy", "生活方式", "礼品"]
  }
];

const plans = [
  { id: "starter", name: "Starter", price: 19, currency: "USD", credits: 200, stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || "", features: ["每月 200 积分", "商品图生成", "Listing Pack 导出"] },
  { id: "pro", name: "Pro", price: 49, currency: "USD", credits: 1200, stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "", features: ["每月 1200 积分", "批量项目生成", "多平台适配", "高清导出"] },
  { id: "business", name: "Business", price: 129, currency: "USD", credits: 5000, stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID || "", features: ["每月 5000 积分", "团队工作区", "优先生成队列", "商业素材归档"] }
];

const defaultSettings = {
  workspaceName: "SellerCanvas Studio",
  aiProvider: process.env.AI_PROVIDER || "local-commercial",
  providerMode: process.env.AI_PROVIDER ? "api" : "local-fallback",
  providerBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  textModel: process.env.TEXT_MODEL || "gpt-5.5",
  imageModel: process.env.IMAGE_MODEL || "local-svg-renderer",
  copyModel: process.env.COPY_MODEL || "local-listing-engine",
  brandTone: "Professional, conversion-focused, marketplace compliant",
  monthlyQuota: 1200,
  usedCredits: 86,
  subscription: "Pro",
  team: [
    { name: "Owner", role: "管理员", email: "owner@sellercanvas.local" },
    { name: "Designer", role: "设计审核", email: "designer@sellercanvas.local" }
  ],
  webhooks: [],
  security: { requireLogin: false, exportWatermark: false, auditLog: true }
};

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function hashSecret(value, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(value), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifySecret(value, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.pbkdf2Sync(String(value), salt, 120000, 32, "sha256");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    provider: user.provider,
    subscription: user.subscription,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf("=");
    return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
  }));
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function currentUser(db, req) {
  const token = parseCookies(req)[sessionCookie];
  if (!token) return null;
  const session = (db.sessions || []).find((item) => item.token === token && new Date(item.expiresAt) > new Date());
  if (!session) return null;
  return (db.users || []).find((user) => user.id === session.userId) || null;
}

function createSession(db, user, req) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions.unshift({
    id: id("sess"),
    token,
    userId: user.id,
    ip: req.socket.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    createdAt: now(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  });
  db.sessions = db.sessions.slice(0, 500);
  user.lastLoginAt = now();
  return token;
}

function requireUser(res, user) {
  if (user) return true;
  json(res, 401, { error: "Authentication required" });
  return false;
}

function requireAdmin(res, user) {
  if (user?.role === "admin") return true;
  json(res, 403, { error: "Admin access required" });
  return false;
}

function ownerCanAccess(user, project) {
  return user?.role === "admin" || project.ownerId === user?.id;
}

function apiKeyPrefix(raw) {
  return raw.slice(0, 12);
}

function hashApiKey(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function findApiIdentity(db, req) {
  const auth = req.headers.authorization || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return null;
  const keyHash = hashApiKey(raw);
  const key = (db.apiKeys || []).find((item) => item.hash === keyHash && !item.revokedAt);
  if (!key) return null;
  const user = (db.users || []).find((item) => item.id === key.userId);
  return user ? { key, user } : null;
}

function allowRateLimit(identity, limit = 60) {
  const minute = Math.floor(Date.now() / 60000);
  const bucketKey = `${identity.key.id}:${minute}`;
  const current = rateBuckets.get(bucketKey) || 0;
  if (current >= limit) return false;
  rateBuckets.set(bucketKey, current + 1);
  return true;
}

function oauthConfig(provider, req) {
  const upper = provider.toUpperCase();
  const origin = process.env.PUBLIC_APP_URL || `http://${req.headers.host || "localhost:4173"}`;
  return {
    provider,
    clientId: process.env[`${upper}_CLIENT_ID`] || "",
    clientSecret: process.env[`${upper}_CLIENT_SECRET`] || "",
    redirectUri: `${origin.replace(/\/$/, "")}/api/auth/oauth/${provider}/callback`
  };
}

async function exchangeOAuthProfile(provider, code, config) {
  if (provider === "github") {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri })
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error("GitHub OAuth token exchange failed");
    const profileResponse = await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${tokenPayload.access_token}`, "user-agent": "SellerCanvas AI" } });
    const profile = await profileResponse.json();
    const emailResponse = await fetch("https://api.github.com/user/emails", { headers: { authorization: `Bearer ${tokenPayload.access_token}`, "user-agent": "SellerCanvas AI" } });
    const emails = await emailResponse.json().catch(() => []);
    const primary = Array.isArray(emails) ? emails.find((item) => item.primary) || emails[0] : null;
    return { email: primary?.email || profile.email, name: profile.name || profile.login };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: config.redirectUri })
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error("Google OAuth token exchange failed");
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${tokenPayload.access_token}` } });
  const profile = await profileResponse.json();
  return { email: profile.email, name: profile.name };
}

function defaultProductImage() {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <rect width="1200" height="900" fill="#fff"/>
    <ellipse cx="600" cy="782" rx="390" ry="42" fill="#d9e2ec"/>
    <g stroke="#2b3440" stroke-width="22" stroke-linecap="round" fill="none">
      <path d="M258 272h684"/><path d="M246 542h708"/><path d="M282 236v496"/><path d="M918 236v496"/>
      <path d="M282 236c0-50 56-76 100-49"/><path d="M918 236c0-50-56-76-100-49"/>
    </g>
    <g stroke="#a8b3bd" stroke-width="16" stroke-linecap="round"><path d="M318 342h564"/><path d="M318 618h564"/></g>
    <g stroke="#2b3440" stroke-width="9">
      <rect x="382" y="316" width="86" height="196" rx="18" fill="#f8d9a4"/><rect x="392" y="288" width="66" height="34" rx="8" fill="#2b3440"/>
      <rect x="500" y="280" width="112" height="232" rx="24" fill="#edf5f8"/><rect x="518" y="246" width="76" height="42" rx="10" fill="#2b3440"/>
      <rect x="642" y="326" width="92" height="186" rx="20" fill="#f8d9a4"/><rect x="654" y="296" width="68" height="34" rx="8" fill="#2b3440"/>
      <rect x="760" y="266" width="80" height="246" rx="18" fill="#f2f4f7"/><rect x="772" y="236" width="56" height="34" rx="8" fill="#2b3440"/>
      <rect x="356" y="584" width="92" height="92" rx="18" fill="#efb05a"/><rect x="478" y="584" width="92" height="92" rx="18" fill="#f5d08f"/>
      <rect x="600" y="584" width="92" height="92" rx="18" fill="#d7e9ed"/><rect x="722" y="584" width="92" height="92" rx="18" fill="#f8d9a4"/>
    </g>
    <g stroke="#2b3440" stroke-width="14" stroke-linecap="round" fill="none"><path d="M218 430c-54 20-76 62-58 118"/><path d="M200 430v160"/><path d="M982 430c54 20 76 62 58 118"/><path d="M1000 430v160"/></g>
  </svg>`)}`;
}

function seedDb() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sellercanvas.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!ChangeMe";
  const admin = {
    id: id("user"),
    email: adminEmail.toLowerCase(),
    name: "SellerCanvas Admin",
    role: "admin",
    provider: "email",
    passwordHash: hashSecret(adminPassword),
    subscription: { plan: "business", status: "active", credits: 5000, renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() },
    createdAt: now(),
    lastLoginAt: null
  };
  const project = buildProject(templates[0], "Kitchen Rack Listing Kit");
  project.ownerId = admin.id;
  project.status = "generated";
  project.analysis = analyzeProject(project);
  project.prompts = buildPrompts(project, project.platform);
  project.copy = buildCopy(project);
  project.assets = buildAssets(project);
  const history = [{
    id: id("hist"),
    projectId: project.id,
    type: "generate",
    title: "生成 4 张核心资产",
    detail: "主图、场景图、尺寸图、营销图已生成",
    createdAt: now(),
    assetCount: 4
  }];
  return {
    version: 2,
    settings: defaultSettings,
    platforms,
    assetTypes,
    templates,
    plans,
    users: [admin],
    sessions: [],
    apiKeys: [],
    apiUsage: [],
    projects: [project],
    history,
    exports: [],
    payments: [],
    subscriptions: [],
    invoices: [],
    auditLogs: [{ id: id("log"), type: "system", message: "工作区初始化完成", createdAt: now() }]
  };
}

function buildProject(template = templates[0], name = template.name) {
  const createdAt = now();
  return {
    id: id("proj"),
    ownerId: template.ownerId || null,
    name,
    status: "draft",
    platform: template.platform || "amazon",
    product: {
      name: template.productName || "",
      category: template.category || "",
      material: template.material || "",
      style: template.style || "Minimal / Modern",
      points: template.points || [],
      audience: "跨境电商消费者",
      priceRange: "$19.99 - $39.99"
    },
    image: defaultProductImage(),
    analysis: null,
    prompts: {},
    copy: { title: "", bullets: [], description: "" },
    assets: [],
    checklist: ["upload", "brief"],
    createdAt,
    updatedAt: createdAt
  };
}

async function ensureDb() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(exportDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    await saveDb(seedDb());
  }
}

async function loadDb() {
  await ensureDb();
  const db = JSON.parse(await fsp.readFile(dbFile, "utf8"));
  db.settings = { ...defaultSettings, ...(db.settings || {}) };
  db.platforms = db.platforms || platforms;
  db.assetTypes = db.assetTypes || assetTypes;
  db.templates = db.templates || templates;
  db.plans = db.plans || plans;
  db.users = db.users || [];
  db.sessions = db.sessions || [];
  db.oauthStates = db.oauthStates || [];
  db.apiKeys = db.apiKeys || [];
  db.apiUsage = db.apiUsage || [];
  db.projects = db.projects || [];
  db.projects.forEach((project) => {
    if (!project.ownerId && db.users[0]) project.ownerId = db.users[0].id;
  });
  db.history = db.history || [];
  db.exports = db.exports || [];
  db.payments = db.payments || [];
  db.subscriptions = db.subscriptions || [];
  db.invoices = db.invoices || [];
  db.auditLogs = db.auditLogs || [];
  if (!db.users.some((user) => user.role === "admin")) {
    db.users.unshift({
      id: id("user"),
      email: (process.env.ADMIN_EMAIL || "admin@sellercanvas.local").toLowerCase(),
      name: "SellerCanvas Admin",
      role: "admin",
      provider: "email",
      passwordHash: hashSecret(process.env.ADMIN_PASSWORD || "Admin123!ChangeMe"),
      subscription: { plan: "business", status: "active", credits: 5000, renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() },
      createdAt: now(),
      lastLoginAt: null
    });
  }
  return db;
}

async function saveDb(db) {
  await fsp.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function projectProgress(project) {
  const checks = [
    Boolean(project.image),
    Boolean(project.product.name && project.product.category),
    Boolean(project.analysis),
    Boolean(Object.keys(project.prompts || {}).length),
    Boolean(project.assets && project.assets.length),
    Boolean(project.copy && project.copy.title),
    project.status === "exported"
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function findProject(db, projectId) {
  return db.projects.find((project) => project.id === projectId);
}

function getPlatform(platformId) {
  return platforms.find((platform) => platform.id === platformId) || platforms[0];
}

function providerStatus(db) {
  const openaiKey = Boolean(process.env.OPENAI_API_KEY);
  const wantsOpenAI = db.settings.aiProvider === "openai";
  const imageModel = wantsOpenAI && (!db.settings.imageModel || db.settings.imageModel === "local-svg-renderer")
    ? "gpt-image-2"
    : db.settings.imageModel || defaultSettings.imageModel;
  const copyModel = wantsOpenAI && (!db.settings.copyModel || db.settings.copyModel === "local-listing-engine")
    ? db.settings.textModel || defaultSettings.textModel
    : db.settings.copyModel || defaultSettings.copyModel;
  return {
    provider: db.settings.aiProvider,
    mode: wantsOpenAI && openaiKey ? "api" : "local-fallback",
    ready: wantsOpenAI ? openaiKey : true,
    keySource: openaiKey ? "OPENAI_API_KEY 环境变量" : "未配置",
    baseUrl: db.settings.providerBaseUrl || defaultSettings.providerBaseUrl,
    textModel: db.settings.textModel || defaultSettings.textModel,
    imageModel,
    copyModel,
    canAnalyzeImage: wantsOpenAI && openaiKey,
    canGenerateImage: wantsOpenAI && openaiKey,
    fallbackReason: wantsOpenAI && !openaiKey ? "已选择 OpenAI，但未配置 OPENAI_API_KEY" : ""
  };
}

function extractResponseText(payload) {
  if (payload.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) chunks.push(content.text);
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractJson(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

async function callOpenAIText(db, input) {
  const status = providerStatus(db);
  if (status.provider !== "openai" || !process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI provider is not configured");
  }
  const response = await fetch(`${status.baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: status.textModel,
      input,
      temperature: 0.4
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "OpenAI text request failed");
  return extractResponseText(payload);
}

async function callOpenAIImage(db, prompt, platformId) {
  const status = providerStatus(db);
  if (status.provider !== "openai" || !process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI image provider is not configured");
  }
  const platform = getPlatform(platformId);
  const size = platform.ratio === "4:5" ? "1024x1536" : "1024x1024";
  const response = await fetch(`${status.baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: status.imageModel || "gpt-image-2",
      prompt,
      size,
      quality: "auto"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "OpenAI image request failed");
  const image = payload.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image?.url) return image.url;
  throw new Error("OpenAI image response did not include image data");
}

function promptLogicBrief(project) {
  const platform = getPlatform(project.platform);
  return {
    doctrine: directorDoctrine,
    objective: "先理解用户上传图片中的真实商品，再反向推导可复现、可控、平台合规的 Prompt，最后按资产类型生成图片。",
    stages: [
      "视觉识别：主体、材质、颜色、结构、使用场景、拍摄角度、背景、光线、瑕疵和不可改动特征",
      "商业抽象：提炼品类、核心卖点、买家意图、转化阻力和平台风险",
      "Prompt 反推：把图片事实转成 subject/material/shape/camera/light/background/compliance/negative prompt",
      "资产分流：主图、场景图、尺寸图、营销图使用不同构图和文案约束",
      "平台合规：套用目标平台比例、主图规则、文字限制和风格边界"
    ],
    platformRule: platform.rule,
    assetRules: assetTypes.map((type) => `${type.label}: ${type.purpose}`)
  };
}

function buildBuyerMindMap(project, analysis = {}) {
  const product = project.product;
  const points = product.points.length ? product.points : ["premium texture", "easy to use", "space saving"];
  return {
    firstGlance: `用清晰主体轮廓、材质高光和平台友好构图抓住注意力，让买家 1 秒内知道这是 ${product.name || analysis.category || "the product"}。`,
    secondGlance: `通过 ${points.slice(0, 2).join(" + ")} 的细节证据建立兴趣和信任。`,
    trustBuilder: `展示真实材质、比例、边缘、结构和使用方式，避免过度修图造成不可信。`,
    desireTrigger: `把产品放进 ${product.style || "aspirational lifestyle"} 场景，让买家联想到拥有后的整洁、轻松和高级感。`,
    actionCue: `用合规卖点、清晰留白和可读信息降低犹豫，推动加入购物车。`
  };
}

function buildAidaFab(project, analysis = {}) {
  const points = project.product.points.length ? project.product.points : ["durable", "space saving", "easy to use"];
  return {
    attention: `主体占据视觉中心，使用高反差边缘、干净背景和材质反光吸引点击。`,
    interest: `用场景和细节解释 ${analysis.category || project.product.category} 的具体用途。`,
    desire: `把 ${points.slice(0, 3).join(", ")} 转换成买家可感知的生活改善。`,
    action: `保留平台安全区，给标题、徽章或 A+ 信息留下清晰阅读空间。`,
    fab: points.slice(0, 5).map((point) => ({
      feature: point,
      advantage: `${point} makes the product easier to understand and compare.`,
      benefit: `Buyer feels the product solves a real daily problem with less risk.`
    }))
  };
}

function buildReverseBasis(project, analysis = {}) {
  const product = project.product;
  return {
    subject: product.name || analysis.category || "premium ecommerce product",
    productRole: `${product.name || "Product"} 扮演“让日常变得更高效、更有质感的解决方案”角色。`,
    brandPersona: `${product.style || "Modern"}、可信、干净、转化导向，适合跨境平台首屏展示。`,
    materialTexture: analysis.material || product.material || "真实、清晰、可触摸的材质纹理",
    shapeStructure: analysis.category || product.category || "完整产品结构和真实比例",
    sceneNarrative: `一个目标买家正在追求更省心、更整洁、更高级的生活，产品自然成为场景中的关键解决方案。`,
    cameraAngle: "45-degree commercial product angle for main and marketing, eye-level lifestyle perspective for scene, orthographic layout for dimensions",
    lighting: "softbox studio light for main image, golden morning natural light for lifestyle scene, high clarity technical lighting for dimension image",
    colorStrategy: "clean neutral base with warm accent contrast; avoid cheap over-saturation unless platform campaign requires it",
    background: "platform-compliant white or aspirational lifestyle environment with clear safe area",
    emotionalAnchor: "这就是我想要的更整洁、更轻松、更有品质的生活",
    keepUnchanged: ["真实商品结构", "主要材质", "核心颜色", "可识别比例", "平台合规边界"],
    negativePrompt: "no fake logo, no watermark, no distorted product, no impossible structure, no false certification, no medical claim, no exaggerated guarantee, no unreadable text"
  };
}

function qualityGate(project, prompts) {
  const joined = Object.values(prompts || {}).join(" ").toLowerCase();
  const checks = [
    ["AIDA", /attention|interest|desire|action|buyer|conversion|high conversion/.test(joined)],
    ["FAB", /benefit|advantage|feature|value|selling point/.test(joined)],
    ["场景叙事", /scene|lifestyle|story|environment|aspirational/.test(joined)],
    ["材质质感", /material|texture|photorealistic|premium/.test(joined)],
    ["平台合规", /platform|compliant|safe area|white background|no watermark/.test(joined)],
    ["负面约束", /negative prompt|no fake|no watermark|no distorted/.test(joined)]
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks: checks.map(([name, ok]) => ({ name, passed: Boolean(ok) })),
    verdict: passed >= 5 ? "pass" : "revise",
    directorNote: passed >= 5
      ? "提示词已具备导演级画面、营销转化和平台合规基础。"
      : "提示词仍偏功能描述，需要强化场景叙事、情绪锚点和买家行动引导。"
  };
}

async function analyzeProjectWithProvider(db, project) {
  const status = providerStatus(db);
  if (status.provider !== "openai" || !status.ready) {
    const analysis = analyzeProject(project);
    analysis.provider = status.mode;
    analysis.promptLogic = promptLogicBrief(project);
    return { analysis, prompts: buildPrompts(project, project.platform, analysis), copy: buildCopy(project, analysis), providerUsed: status.mode };
  }

  const platform = getPlatform(project.platform);
  const system = [
    `You are SellerCanvas AI: ${directorDoctrine.role}.`,
    directorDoctrine.mission,
    "Analyze the product image first. Reverse-engineer prompts from the image facts, not generic assumptions.",
    "Think like a visual marketing director, not an image captioner. Direct a visual film that makes buyers want the product.",
    "Apply AIDA and FAB. Simulate buyer psychology before writing prompts.",
    "Never output a flat generic prompt. Every prompt needs role, brand persona, scene narrative, visual impact, platform parameters, emotional anchor, and negative constraints.",
    "Return strict JSON only. Do not include markdown.",
    "Prompts must be production-ready for ecommerce image generation, platform compliant, and split into main, scene, dimension, marketing.",
    "Avoid unsafe claims, medical claims, fake certifications, fake brand names, and impossible physical changes."
  ].join(" ");
  const userText = {
    task: "Analyze product image, infer product facts, build reverse prompts, listing copy, compliance risks, and export-ready creative plan.",
    platform,
    productBrief: project.product,
    requiredJsonShape: {
      analysis: {
        category: "string",
        material: "string",
        confidence: "number 0-1",
        visualFacts: ["string"],
        buyerIntent: ["string"],
        risks: ["string"],
        recommendations: ["string"],
        buyerMindMap: {
          firstGlance: "string",
          secondGlance: "string",
          trustBuilder: "string",
          desireTrigger: "string",
          actionCue: "string"
        },
        aidaFab: {
          attention: "string",
          interest: "string",
          desire: "string",
          action: "string",
          fab: [{ feature: "string", advantage: "string", benefit: "string" }]
        },
        reversePromptBasis: {
          subject: "string",
          productRole: "string",
          brandPersona: "string",
          materialTexture: "string",
          shapeStructure: "string",
          sceneNarrative: "string",
          cameraAngle: "string",
          lighting: "string",
          colorStrategy: "string",
          background: "string",
          emotionalAnchor: "string",
          keepUnchanged: ["string"],
          negativePrompt: "string"
        }
      },
      prompts: { main: "string", scene: "string", dimension: "string", marketing: "string" },
      copy: { title: "string", bullets: ["string"], description: "string" }
    }
  };
  const input = [{
    role: "user",
    content: [
      { type: "input_text", text: `${system}\n\n${JSON.stringify(userText)}` },
      { type: "input_image", image_url: project.image }
    ]
  }];
  const text = await callOpenAIText(db, input);
  const parsed = extractJson(text);
  parsed.analysis.provider = "openai";
  parsed.analysis.promptLogic = promptLogicBrief(project);
  parsed.analysis.buyerMindMap = parsed.analysis.buyerMindMap || buildBuyerMindMap(project, parsed.analysis);
  parsed.analysis.aidaFab = parsed.analysis.aidaFab || buildAidaFab(project, parsed.analysis);
  parsed.analysis.reversePromptBasis = parsed.analysis.reversePromptBasis || buildReverseBasis(project, parsed.analysis);
  parsed.analysis.qualityGate = qualityGate(project, parsed.prompts || {});
  return {
    analysis: parsed.analysis,
    prompts: parsed.prompts || buildPrompts(project, project.platform, parsed.analysis),
    copy: parsed.copy || buildCopy(project, parsed.analysis),
    providerUsed: "openai"
  };
}

function analyzeProject(project) {
  const text = `${project.product.name} ${project.product.category} ${project.product.material}`.toLowerCase();
  const points = project.product.points.filter(Boolean);
  const category = text.includes("pet") ? "Pet Supplies" : text.includes("lamp") || text.includes("light") ? "Home Lighting" : text.includes("rack") || text.includes("storage") ? "Home & Kitchen Storage" : project.product.category || "General Ecommerce";
  const material = text.includes("silicone") ? "Food-grade Silicone" : text.includes("wood") ? "Natural Wood" : text.includes("steel") ? "Stainless Steel" : project.product.material || "Premium Material";
  const analysis = {
    category,
    material,
    confidence: 0.94,
    visualFacts: [
      `主体应保持为 ${project.product.name || category}`,
      `材质重点呈现 ${material} 的真实纹理和边缘高光`,
      `构图需要兼顾平台首图清晰度和营销图情绪张力`
    ],
    targetPlatforms: platforms.map((platform) => platform.name),
    buyerIntent: ["整理收纳", "耐用材质", "节省空间", "快速安装"].filter((item, index) => points[index] || index < 2),
    risks: ["主图避免水印和多余文字", "尺寸图需要与真实参数一致", "营销图避免绝对化违规词"],
    recommendations: [
      `首图突出 ${material} 质感和完整产品轮廓`,
      `场景图使用 ${project.product.style} 风格提高代入感`,
      `标题前 80 个字符包含品类、材质和核心卖点`,
      `营销图需要用 AIDA 路径推动买家从注意到行动`
    ],
    reversePromptBasis: buildReverseBasis(project, { category, material }),
    buyerMindMap: buildBuyerMindMap(project, { category, material }),
    aidaFab: buildAidaFab(project, { category, material }),
    updatedAt: now()
  };
  analysis.promptLogic = promptLogicBrief(project);
  return analysis;
}

function buildPrompts(project, platformId, analysis = project.analysis) {
  const platform = getPlatform(platformId);
  const product = project.product;
  const points = product.points.join(", ");
  const reverse = analysis?.reversePromptBasis || {};
  const mind = analysis?.buyerMindMap || buildBuyerMindMap(project, analysis);
  const facts = [
    reverse.subject || product.name,
    reverse.materialTexture || product.material,
    reverse.shapeStructure || analysis?.category || product.category,
    reverse.cameraAngle || "front three-quarter product angle",
    reverse.lighting || "soft commercial studio lighting"
  ].filter(Boolean).join(", ");
  const negative = reverse.negativePrompt || "no watermark, no fake logo, no distorted geometry, no unreadable text, no exaggerated claims";
  const base = `${facts}, ${product.style}, ${platform.name} ecommerce listing`;
  const role = reverse.productRole || `${product.name} as the hero solution in a premium ecommerce visual story`;
  const persona = reverse.brandPersona || `${product.style} trustworthy conversion-focused brand`;
  const story = reverse.sceneNarrative || mind.desireTrigger;
  const color = reverse.colorStrategy || "clean neutral palette with warm high-conversion accents";
  const anchor = reverse.emotionalAnchor || mind.desireTrigger;
  const safe = `Platform parameters: ${platform.name}, ${platform.ratio}, ${platform.size}, safe area for optional overlay text, rule: ${platform.rule}.`;
  const prompts = {
    main: [
      `Director-level ecommerce MAIN IMAGE. Product role: ${role}. Brand persona: ${persona}.`,
      `Show ${base} as the single hero product on a pure white premium studio background.`,
      `Buyer psychology: first glance must stop scrolling through clear silhouette and material highlights; second glance must build trust through exact structure, proportion, crisp edges, and tactile ${reverse.materialTexture || product.material} texture.`,
      `Visual impact: softbox studio light, subtle grounding shadow, centered composition, high clarity, true-to-product color, no lifestyle clutter.`,
      `AIDA/FAB: attention through clarity, interest through material detail, desire through premium trust, action through lower purchase risk. Feature/advantage/benefit: ${points || product.material}.`,
      safe,
      `Emotional anchor: ${anchor}. Negative prompt: ${negative}.`
    ].join(" "),
    scene: [
      `Director-level LIFESTYLE SCENE. Product role: ${role}. Brand persona: ${persona}.`,
      `Create a desirable real-life scene: ${story}. The product should feel naturally used, not staged.`,
      `Buyer psychology: attention through warm light and clean composition; interest through visible use case; desire through an aspirational but believable lifestyle moment; action through clear product readability.`,
      `Visual impact: golden morning natural light, 45-degree or eye-level camera, shallow depth of field, ${color}, premium commercial photography, natural shadows.`,
      `FAB: convert features (${points}) into buyer benefits: more order, more ease, more confidence.`,
      safe,
      `Emotional anchor: this is the better daily life I want. Negative prompt: ${negative}.`
    ].join(" "),
    dimension: [
      `Director-level DIMENSION INFOGRAPHIC for ${base}.`,
      `Preserve exact product structure and proportions. Use white or very light technical background, clean measurement arrows, readable labels, and platform-safe text zones.`,
      `Buyer psychology: reduce hesitation by answering size and fit questions instantly; build trust through clean, precise, non-exaggerated presentation.`,
      `Visual impact: orthographic product view, crisp lines, minimal typography, high contrast but not cheap, no fake measurements unless user provides values.`,
      `AIDA/FAB: attention from clarity, interest from practical details, desire from confidence, action from lower return anxiety.`,
      safe,
      `Negative prompt: ${negative}.`
    ].join(" "),
    marketing: [
      `Director-level HIGH-CONVERSION MARKETING IMAGE for ${base}. Product role: ${role}.`,
      `Create a scroll-stopping conversion visual that dramatizes the buyer benefit without distorting the product.`,
      `Buyer psychology: first-glance contrast grabs attention; close-up material proof creates interest; benefit badges stimulate desire; clean callout safe area supports action.`,
      `Visual impact: dynamic commercial composition, tactile macro detail, benefit badge system, before/after or comparison cue if compliant, ${color}, mobile readable layout.`,
      `FAB/AIDA: features ${points}; advantages are durability, convenience, and clearer use; benefits are confidence, easier life, and purchase justification.`,
      safe,
      `Emotional trigger: ${anchor}. Negative prompt: ${negative}.`
    ].join(" ")
  };
  if (analysis) analysis.qualityGate = qualityGate(project, prompts);
  return prompts;
}

function buildCopy(project, analysis = project.analysis) {
  const product = project.product;
  const points = product.points.length ? product.points : ["Durable", "Space saving", "Easy to use", "Premium", "Gift ready"];
  const title = `${product.name} for ${product.category}, ${product.material}, ${points.slice(0, 3).join(", ")}`;
  return {
    title: title.slice(0, 190),
    bullets: [
      `Premium ${analysis?.material || product.material} construction supports long-term daily use and a polished listing presentation.`,
      `${points[0]} design helps buyers understand the product benefit within the first screen.`,
      `${points[1] || "Space saving"} layout improves practical value for home, office, or travel scenarios.`,
      `${product.style} visual direction keeps images consistent across marketplace and social channels.`,
      `${points[2] || "Easy setup"} experience reduces purchase hesitation and supports better conversion.`
    ],
    description: `${product.name} is positioned for cross-border ecommerce sellers who need clear product value, platform-compliant imagery, and conversion-focused listing copy.`
  };
}

async function buildAssetsWithProvider(db, project) {
  const status = providerStatus(db);
  const assets = [];
  for (const type of assetTypes) {
    const prompt = project.prompts[type.id] || "";
    let dataUrl = "";
    let format = "svg";
    let provider = status.mode;
    if (status.provider === "openai" && status.ready) {
      try {
        dataUrl = await callOpenAIImage(db, prompt, project.platform);
        format = dataUrl.startsWith("data:image/png") ? "png" : "url";
        provider = "openai";
      } catch (error) {
        dataUrl = renderAssetSvg(project, type);
        provider = `local-fallback: ${error.message}`;
      }
    } else {
      dataUrl = renderAssetSvg(project, type);
    }
    assets.push({
      id: id("asset"),
      type: type.id,
      label: type.label,
      format,
      platform: project.platform,
      dataUrl,
      prompt,
      provider,
      createdAt: now()
    });
  }
  return assets;
}

function buildAssets(project) {
  return assetTypes.map((type) => ({
    id: id("asset"),
    type: type.id,
    label: type.label,
    format: "svg",
    platform: project.platform,
    dataUrl: renderAssetSvg(project, type),
    prompt: project.prompts[type.id] || "",
    provider: "local-seed",
    createdAt: now()
  }));
}

function renderAssetSvg(project, type) {
  const product = escapeXml(project.product.name);
  const platform = getPlatform(project.platform);
  const points = project.product.points.slice(0, 3).map(escapeXml);
  const width = platform.ratio === "4:5" ? 1080 : 1200;
  const height = platform.ratio === "4:5" ? 1350 : 1200;
  const bg = type.color;
  const title = type.id === "main" ? product : type.id === "scene" ? `${escapeXml(platform.name)} Lifestyle Scene` : type.id === "dimension" ? "Clear Dimensions" : "Benefit Comparison";
  const room = type.id === "scene" ? `<rect y="${height * 0.62}" width="${width}" height="${height * 0.38}" fill="#ead2b7"/><rect x="${width * 0.08}" y="140" width="52" height="${height * 0.44}" fill="#fff8" rx="8"/><rect x="${width * 0.82}" y="120" width="70" height="${height * 0.5}" fill="#fff8" rx="8"/>` : "";
  const grid = type.id === "dimension" ? Array.from({ length: 12 }, (_, index) => `<path d="M${index * 100} 0V${height}" stroke="#d8e2ed" stroke-width="2"/>`).join("") : "";
  const badges = type.id === "marketing" ? points.map((point, index) => `<g><rect x="${width * 0.58}" y="${230 + index * 88}" width="${width * 0.32}" height="56" rx="10" fill="#fff" stroke="#9bdcc2"/><text x="${width * 0.61}" y="${266 + index * 88}" font-size="24" font-weight="800" fill="#067647">✓ ${point}</text></g>`).join("") : "";
  const dim = type.id === "dimension" ? `<path d="M260 830H940M240 440V790" stroke="#111827" stroke-width="4"/><text x="565" y="880" font-size="30" font-weight="800">60cm</text><text x="150" y="640" font-size="30" font-weight="800" transform="rotate(-90 150 640)">34cm</text>` : "";
  const productX = type.id === "marketing" ? width * 0.08 : width * 0.25;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${bg}"/>
    ${room}${grid}
    <text x="${type.id === "marketing" ? width * 0.58 : 64}" y="86" font-family="Arial" font-size="42" font-weight="900" fill="#0f172a">${title}</text>
    <text x="${type.id === "marketing" ? width * 0.58 : 64}" y="${height - 88}" font-family="Arial" font-size="24" font-weight="600" fill="#475467">${points.join(" / ")}</text>
    <ellipse cx="${productX + 300}" cy="${height * 0.68}" rx="310" ry="36" fill="#cbd5e1"/>
    <g transform="translate(${productX}, ${height * 0.28})">
      <g stroke="#2b3440" stroke-width="18" stroke-linecap="round" fill="none"><path d="M30 110H600"/><path d="M15 330H620"/><path d="M60 75v430"/><path d="M570 75v430"/><path d="M60 75c0-38 46-60 78-38"/><path d="M570 75c0-38-46-60-78-38"/></g>
      <g stroke="#9aa7b2" stroke-width="13" stroke-linecap="round"><path d="M95 165H535"/><path d="M95 395H535"/></g>
      <g stroke="#2b3440" stroke-width="7">
        <rect x="150" y="145" width="72" height="166" rx="16" fill="#f8d9a4"/><rect x="242" y="120" width="92" height="190" rx="18" fill="#edf5f8"/><rect x="356" y="155" width="80" height="155" rx="15" fill="#f8d9a4"/><rect x="458" y="115" width="66" height="195" rx="14" fill="#f2f4f7"/>
        <rect x="155" y="365" width="72" height="70" rx="12" fill="#efb05a"/><rect x="250" y="365" width="72" height="70" rx="12" fill="#f5d08f"/><rect x="345" y="365" width="72" height="70" rx="12" fill="#d7e9ed"/><rect x="440" y="365" width="72" height="70" rx="12" fill="#f8d9a4"/>
      </g>
    </g>
    ${dim}${badges}
    <text x="64" y="${height - 42}" font-family="Arial" font-size="18" fill="#667085">SellerCanvas AI · ${escapeXml(platform.name)} · ${escapeXml(type.purpose)}</text>
  </svg>`)}`;
}

function escapeXml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
}

function log(db, type, message, meta = {}) {
  db.auditLogs.unshift({ id: id("log"), type, message, meta, createdAt: now() });
  db.auditLogs = db.auditLogs.slice(0, 200);
}

function publicDb(db, user) {
  const isAdmin = user?.role === "admin";
  const visibleProjects = user?.role === "admin" ? db.projects : db.projects.filter((project) => project.ownerId === user?.id);
  const visibleExports = user?.role === "admin" ? db.exports : db.exports.filter((item) => visibleProjects.some((project) => project.id === item.projectId));
  const visibleHistory = user?.role === "admin" ? db.history : db.history.filter((item) => visibleProjects.some((project) => project.id === item.projectId));
  const customerSettings = {
    workspaceName: db.settings?.workspaceName || "SellerCanvas AI"
  };
  return {
    auth: { user: sanitizeUser(user), isAdmin },
    settings: isAdmin ? { ...db.settings, providerStatus: providerStatus(db) } : customerSettings,
    platforms: db.platforms,
    assetTypes: db.assetTypes,
    templates: db.templates,
    plans: db.plans || plans,
    projects: visibleProjects.map((project) => ({ ...project, progress: projectProgress(project) })),
    history: visibleHistory,
    exports: visibleExports,
    invoices: (db.invoices || []).filter((invoice) => isAdmin || invoice.userId === user?.id),
    payments: (db.payments || []).filter((payment) => isAdmin || payment.userId === user?.id),
    apiKeys: isAdmin ? (db.apiKeys || []).filter((key) => !key.revokedAt).map((key) => ({ id: key.id, userId: key.userId, name: key.name, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt })) : [],
    apiUsage: isAdmin ? (db.apiUsage || []).slice(0, 100) : [],
    auditLogs: isAdmin ? db.auditLogs.slice(0, 80) : []
  };
}

async function buildAdminOpsData(db) {
  const accounts = await Promise.all(db.users.map(async (user) => {
    const balance = await apiV2Context.services.creditService.getBalance(user.id);
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.subscription?.plan || "free",
      status: user.subscription?.status || "inactive",
      balance: balance.balance,
      reserved: balance.reserved,
      available: balance.available
    };
  }));
  const ledger = typeof apiV2Context.repositories.creditRepository.listAllLedger === "function"
    ? apiV2Context.repositories.creditRepository.listAllLedger()
    : [];
  const jobs = apiV2Context.repositories.jobRepository.list().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const jobCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  return {
    credits: {
      accounts,
      ledger: ledger.slice(-100).reverse(),
      totals: accounts.reduce((acc, account) => {
        acc.balance += account.balance;
        acc.reserved += account.reserved;
        acc.available += account.available;
        return acc;
      }, { balance: 0, reserved: 0, available: 0 })
    },
    aiJobs: {
      items: jobs.slice(0, 100),
      counts: jobCounts,
      total: jobs.length
    }
  };
}

async function syncCreditAccountsFromLegacySubscriptions(db) {
  for (const user of db.users || []) {
    if (!user?.id) continue;
    const existing = await apiV2Context.repositories.creditRepository.getAccountByUserId(user.id);
    if (existing) continue;
    const credits = Number(user.subscription?.credits || 0);
    if (credits > 0) {
      await safeGrantCredits(user.id, credits, {
        source: "legacy_subscription_bootstrap",
        plan: user.subscription?.plan || "unknown"
      });
    } else {
      await apiV2Context.services.creditService.ensureAccount(user.id);
    }
  }
}

async function safeGrantCredits(userId, amount, meta = {}) {
  if (!userId || !Number(amount)) return;
  try {
    await apiV2Context.services.creditService.grant(userId, Number(amount), meta);
  } catch (error) {
    console.warn("Credit grant failed", error.message || error);
  }
}

async function runMeteredJob(user, projectId, type, work) {
  let job = null;
  try {
    job = await apiV2Context.services.jobService.createJob({
      userId: user.id,
      projectId,
      type,
      input: { source: "customer-app" }
    });
    const result = await work(job);
    await apiV2Context.services.jobService.markSucceeded(job.id, { ok: true });
    return result;
  } catch (error) {
    if (job) {
      try {
        await apiV2Context.services.jobService.markFailed(job.id, error.message || "Job failed");
      } catch (refundError) {
        console.warn("Credit refund failed", refundError.message || refundError);
      }
    }
    throw error;
  }
}

async function api(req, res, pathname) {
  try {
    const db = await loadDb();
    await syncCreditAccountsFromLegacySubscriptions(db);
    const method = req.method || "GET";
    const parts = pathname.split("/").filter(Boolean);
    const user = currentUser(db, req);

    if (method === "GET" && pathname === "/api/bootstrap") return json(res, 200, publicDb(db, user));
    if (method === "GET" && pathname === "/api/health") {
      const status = { ok: true, now: now() };
      if (user?.role === "admin") {
        return json(res, 200, { ...status, provider: providerStatus(db), projects: db.projects.length, exports: db.exports.length });
      }
      return json(res, 200, status);
    }

    if (method === "POST" && pathname === "/api/auth/register") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: "Valid email required" });
      if (password.length < 8) return json(res, 400, { error: "Password must be at least 8 characters" });
      if (db.users.some((item) => item.email === email)) return json(res, 409, { error: "Email already registered" });
      const created = {
        id: id("user"),
        email,
        name: body.name || email.split("@")[0],
        role: "customer",
        provider: "email",
        passwordHash: hashSecret(password),
        subscription: { plan: "starter", status: "trialing", credits: 50, renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() },
        createdAt: now(),
        lastLoginAt: null
      };
      db.users.unshift(created);
      await safeGrantCredits(created.id, created.subscription.credits, {
        source: "trial",
        reason: "register_trial"
      });
      const token = createSession(db, created, req);
      setSessionCookie(res, token);
      log(db, "auth", `用户注册：${email}`);
      await saveDb(db);
      return json(res, 201, { user: sanitizeUser(created) });
    }

    if (method === "POST" && pathname === "/api/auth/login") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const found = db.users.find((item) => item.email === email);
      if (!found || !verifySecret(body.password || "", found.passwordHash)) return json(res, 401, { error: "Invalid email or password" });
      const token = createSession(db, found, req);
      setSessionCookie(res, token);
      log(db, "auth", `用户登录：${email}`);
      await saveDb(db);
      return json(res, 200, { user: sanitizeUser(found) });
    }

    if (method === "POST" && pathname === "/api/auth/logout") {
      const token = parseCookies(req)[sessionCookie];
      db.sessions = (db.sessions || []).filter((session) => session.token !== token);
      clearSessionCookie(res);
      await saveDb(db);
      return json(res, 200, { ok: true });
    }

    if (method === "GET" && pathname === "/api/auth/me") {
      return json(res, 200, { user: sanitizeUser(user) });
    }

    if (method === "GET" && parts[0] === "api" && parts[1] === "auth" && parts[2] === "oauth" && parts[4] === "start") {
      const provider = parts[3];
      const config = oauthConfig(provider, req);
      const configured = Boolean(config.clientId && config.clientSecret);
      if (configured) {
        const oauthState = crypto.randomBytes(16).toString("hex");
        db.oauthStates.unshift({ state: oauthState, provider, createdAt: now(), expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString() });
        db.oauthStates = db.oauthStates.slice(0, 100);
        await saveDb(db);
        const authorizationUrl = provider === "github"
          ? `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, scope: "read:user user:email", state: oauthState })}`
          : `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "openid email profile", state: oauthState, access_type: "offline", prompt: "select_account" })}`;
        return json(res, 200, { provider, configured, authorizationUrl });
      }
      return json(res, 200, {
        provider,
        configured,
        message: "OAuth provider is not configured. Set CLIENT_ID and CLIENT_SECRET environment variables."
      });
    }

    if (method === "GET" && parts[0] === "api" && parts[1] === "auth" && parts[2] === "oauth" && parts[4] === "callback") {
      const provider = parts[3];
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const saved = db.oauthStates.find((item) => item.state === stateParam && item.provider === provider && new Date(item.expiresAt) > new Date());
      if (!code || !saved) {
        res.writeHead(302, { location: "/#/login?oauth=failed" });
        res.end();
        return;
      }
      const config = oauthConfig(provider, req);
      const profile = await exchangeOAuthProfile(provider, code, config);
      if (!profile.email) throw new Error("OAuth profile did not include email");
      let oauthUser = db.users.find((item) => item.email === profile.email.toLowerCase());
      if (!oauthUser) {
        oauthUser = {
          id: id("user"),
          email: profile.email.toLowerCase(),
          name: profile.name || profile.email.split("@")[0],
          role: "customer",
          provider,
          passwordHash: "",
          subscription: { plan: "starter", status: "trialing", credits: 50, renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() },
          createdAt: now(),
          lastLoginAt: null
        };
        db.users.unshift(oauthUser);
        await safeGrantCredits(oauthUser.id, oauthUser.subscription.credits, {
          source: "trial",
          reason: "oauth_register_trial",
          provider
        });
      }
      db.oauthStates = db.oauthStates.filter((item) => item.state !== stateParam);
      const token = createSession(db, oauthUser, req);
      setSessionCookie(res, token);
      log(db, "auth", `OAuth 登录：${oauthUser.email}`, { provider });
      await saveDb(db);
      res.writeHead(302, { location: "/#/dashboard" });
      res.end();
      return;
    }

    if (method === "GET" && pathname === "/api/pricing/plans") {
      return json(res, 200, { plans: db.plans || plans });
    }

    if (pathname.startsWith("/v1/")) {
      const identity = findApiIdentity(db, req);
      if (!identity) return json(res, 401, { error: "Valid API key required" });
      if (!allowRateLimit(identity, 60)) return json(res, 429, { error: "Rate limit exceeded" });
      identity.key.lastUsedAt = now();
      db.apiUsage.unshift({ id: id("usage"), userId: identity.user.id, apiKeyId: identity.key.id, endpoint: pathname, units: 1, createdAt: now(), status: "ok" });
      db.apiUsage = db.apiUsage.slice(0, 5000);
      if (method === "POST" && pathname === "/v1/generate") {
        const body = await readBody(req);
        const project = buildProject({ ...templates[0], ...(body.product || {}), ownerId: identity.user.id }, body.name || "API Listing Kit");
        project.platform = body.platform || project.platform;
        project.analysis = analyzeProject(project);
        project.prompts = buildPrompts(project, project.platform, project.analysis);
        project.copy = buildCopy(project, project.analysis);
        project.assets = body.generateImages === false ? [] : await buildAssetsWithProvider(db, project);
        await saveDb(db);
        return json(res, 200, { project });
      }
      await saveDb(db);
      return json(res, 404, { error: "API endpoint not found" });
    }

    if (method === "GET" && pathname === "/api/admin/overview") {
      if (!requireAdmin(res, user)) return;
      const ops = await buildAdminOpsData(db);
      return json(res, 200, {
        provider: providerStatus(db),
        counts: {
          projects: db.projects.length,
          customers: db.users.filter((item) => item.role !== "admin").length,
          payments: db.payments.length,
          apiCalls: db.apiUsage.length,
          aiJobs: ops.aiJobs.total,
          generated: db.projects.filter((project) => project.status === "generated").length,
          exported: db.exports.length,
          history: db.history.length
        },
        customers: db.users.map(sanitizeUser),
        payments: db.payments,
        apiUsage: db.apiUsage.slice(0, 200),
        apiKeys: db.apiKeys.filter((key) => !key.revokedAt).map((key) => ({ id: key.id, userId: key.userId, name: key.name, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt })),
        latestLogs: db.auditLogs.slice(0, 20),
        credits: ops.credits,
        aiJobs: ops.aiJobs,
        quota: { used: db.settings.usedCredits, total: db.settings.monthlyQuota }
      });
    }
    if (method === "POST" && pathname === "/api/admin/test-provider") {
      if (!requireAdmin(res, user)) return;
      const status = providerStatus(db);
      if (status.provider !== "openai") {
        return json(res, 200, { ok: true, provider: status, message: "本地 Provider 可用。配置 aiProvider=openai 和 OPENAI_API_KEY 后可测试真实 API。" });
      }
      if (!status.ready) {
        return json(res, 400, { ok: false, provider: status, error: "OpenAI 未配置 OPENAI_API_KEY" });
      }
      const text = await callOpenAIText(db, [{ role: "user", content: [{ type: "input_text", text: "Return JSON only: {\"ok\":true,\"message\":\"provider ready\"}" }] }]);
      return json(res, 200, { ok: true, provider: status, raw: text, parsed: extractJson(text) });
    }

    if (method === "POST" && pathname === "/api/projects") {
      if (!requireUser(res, user)) return;
      const body = await readBody(req);
      const template = templates.find((item) => item.id === body.templateId) || templates[0];
      const project = buildProject({ ...template, ...(body.product || {}), ownerId: user.id }, body.name || "Untitled Listing Kit");
      db.projects.unshift(project);
      log(db, "project", `创建项目：${project.name}`);
      await saveDb(db);
      return json(res, 201, { project });
    }

    if (parts[0] === "api" && parts[1] === "projects" && parts[2]) {
      if (!requireUser(res, user)) return;
      const project = findProject(db, parts[2]);
      if (!project) return json(res, 404, { error: "Project not found" });
      if (!ownerCanAccess(user, project)) return json(res, 403, { error: "Project access denied" });

      if (method === "PUT" && parts.length === 3) {
        const body = await readBody(req);
        Object.assign(project, body.project || {});
        project.updatedAt = now();
        log(db, "project", `更新项目：${project.name}`);
        await saveDb(db);
        return json(res, 200, { project });
      }

      if (method === "DELETE" && parts.length === 3) {
        db.projects = db.projects.filter((item) => item.id !== project.id);
        log(db, "project", `删除项目：${project.name}`);
        await saveDb(db);
        return json(res, 200, { ok: true });
      }

      if (method === "POST" && parts[3] === "duplicate") {
        const copy = JSON.parse(JSON.stringify(project));
        copy.id = id("proj");
        copy.name = `${project.name} Copy`;
        copy.status = "draft";
        copy.createdAt = now();
        copy.updatedAt = now();
        db.projects.unshift(copy);
        log(db, "project", `复制项目：${project.name}`);
        await saveDb(db);
        return json(res, 200, { project: copy });
      }

      if (method === "POST" && parts[3] === "upload-image") {
        const body = await readBody(req);
        if (!String(body.image || "").startsWith("data:image/")) return json(res, 400, { error: "Invalid image" });
        project.image = body.image;
        project.uploadName = body.name || "uploaded-product";
        project.status = "brief";
        project.updatedAt = now();
        log(db, "asset", `上传商品图：${project.name}`, { file: project.uploadName });
        await saveDb(db);
        return json(res, 200, { project });
      }

      if (method === "POST" && parts[3] === "analyze") {
        return json(res, 200, await runMeteredJob(user, project.id, JOB_TYPES.IMAGE_ANALYSIS, async () => {
          const result = await analyzeProjectWithProvider(db, project);
          project.analysis = result.analysis;
          project.prompts = result.prompts;
          project.copy = result.copy;
          project.status = "analyzed";
          project.updatedAt = now();
          db.history.unshift({ id: id("hist"), projectId: project.id, type: "analyze", title: "AI ??????", detail: `${project.analysis.category} ? ${project.analysis.material} ? ${result.providerUsed}`, createdAt: now(), assetCount: 0 });
          log(db, "ai", `?????${project.name}`, { provider: result.providerUsed });
          await saveDb(db);
          return { project };
        }));
      }

      if (method === "POST" && parts[3] === "prompts") {
        const body = await readBody(req);
        project.prompts = body.prompts || project.prompts;
        project.updatedAt = now();
        log(db, "prompt", `保存 Prompt：${project.name}`);
        await saveDb(db);
        return json(res, 200, { project });
      }

      if (method === "POST" && parts[3] === "generate") {
        return json(res, 200, await runMeteredJob(user, project.id, JOB_TYPES.IMAGE_GENERATION, async () => {
          if (!project.analysis) {
            const result = await analyzeProjectWithProvider(db, project);
            project.analysis = result.analysis;
            project.prompts = result.prompts;
            project.copy = result.copy;
          }
          if (!Object.keys(project.prompts || {}).length) project.prompts = buildPrompts(project, project.platform, project.analysis);
          project.assets = await buildAssetsWithProvider(db, project);
          project.status = "generated";
          project.updatedAt = now();
          db.settings.usedCredits += 4;
          const providers = [...new Set(project.assets.map((asset) => asset.provider))].join(", ");
          db.history.unshift({ id: id("hist"), projectId: project.id, type: "generate", title: "?? 4 ????", detail: `${getPlatform(project.platform).name} ? ${providers}`, createdAt: now(), assetCount: project.assets.length });
          log(db, "ai", `?????${project.name}`, { providers });
          await saveDb(db);
          return { project };
        }));
      }

      if (method === "POST" && parts[3] === "copy") {
        const body = await readBody(req);
        const saveCopy = async () => {
          project.copy = body.copy || buildCopy(project);
          project.updatedAt = now();
          log(db, "copy", `?? Listing ???${project.name}`);
          await saveDb(db);
          return { project };
        };
        if (body.copy) return json(res, 200, await saveCopy());
        return json(res, 200, await runMeteredJob(user, project.id, JOB_TYPES.LISTING_COPY_GENERATION, saveCopy));
      }

      if (method === "POST" && parts[3] === "export") {
        return json(res, 200, await runMeteredJob(user, project.id, JOB_TYPES.EXPORT_PACKAGING, async () => {
          const pack = {
            project,
            platform: getPlatform(project.platform),
            exportedAt: now(),
            files: project.assets.map((asset) => ({ name: `${project.name}-${asset.type}.svg`, type: asset.type, dataUrl: asset.dataUrl }))
          };
          const file = `${project.id}-${Date.now()}-listing-pack.json`;
          await fsp.writeFile(path.join(exportDir, file), JSON.stringify(pack, null, 2), "utf8");
          const item = { id: id("exp"), projectId: project.id, name: `${project.name} Listing Pack`, href: `/exports/${file}`, createdAt: now(), assetCount: project.assets.length };
          db.exports.unshift(item);
          project.status = "exported";
          project.updatedAt = now();
          db.history.unshift({ id: id("hist"), projectId: project.id, type: "export", title: "?? Listing Pack", detail: item.href, createdAt: now(), assetCount: project.assets.length });
          log(db, "export", `?????${project.name}`);
          await saveDb(db);
          return { export: item, project };
        }));
      }
    }


    if (method === "POST" && parts[0] === "api" && parts[1] === "templates" && parts[3] === "use") {
      if (!requireUser(res, user)) return;
      const template = templates.find((item) => item.id === parts[2]);
      if (!template) return json(res, 404, { error: "Template not found" });
      const project = buildProject({ ...template, ownerId: user.id }, template.name);
      db.projects.unshift(project);
      log(db, "template", `从模板创建项目：${template.name}`);
      await saveDb(db);
      return json(res, 200, { project });
    }

    if (method === "GET" && pathname === "/api/developer/api-keys") {
      if (!requireAdmin(res, user)) return;
      const keys = db.apiKeys.filter((key) => !key.revokedAt).map((key) => ({ id: key.id, userId: key.userId, name: key.name, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt }));
      const usage = db.apiUsage.slice(0, 200);
      return json(res, 200, { keys, usage });
    }

    if (method === "POST" && pathname === "/api/developer/api-keys") {
      if (!requireAdmin(res, user)) return;
      const body = await readBody(req);
      const targetUser = db.users.find((item) => item.id === body.userId) || user;
      const raw = `sk_live_${crypto.randomBytes(24).toString("hex")}`;
      const key = { id: id("key"), userId: targetUser.id, name: body.name || "Default API key", prefix: apiKeyPrefix(raw), hash: hashApiKey(raw), createdAt: now(), lastUsedAt: null, revokedAt: null };
      db.apiKeys.unshift(key);
      log(db, "api", `管理员创建 API Key：${targetUser.email}`, { prefix: key.prefix });
      await saveDb(db);
      return json(res, 201, { key: { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt }, secret: raw });
    }

    if (method === "DELETE" && parts[0] === "api" && parts[1] === "developer" && parts[2] === "api-keys" && parts[3]) {
      if (!requireAdmin(res, user)) return;
      const key = db.apiKeys.find((item) => item.id === parts[3]);
      if (!key) return json(res, 404, { error: "API key not found" });
      key.revokedAt = now();
      log(db, "api", `管理员吊销 API Key`, { prefix: key.prefix });
      await saveDb(db);
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/billing/checkout") {
      if (!requireUser(res, user)) return;
      const body = await readBody(req);
      const plan = (db.plans || plans).find((item) => item.id === body.plan || item.name.toLowerCase() === String(body.plan || "").toLowerCase());
      if (!plan) return json(res, 404, { error: "Plan not found" });
      const payment = { id: id("pay"), userId: user.id, plan: plan.id, amount: plan.price, currency: plan.currency, provider: body.provider || "stripe", status: "pending", createdAt: now(), confirmedAt: null };
      db.payments.unshift(payment);
      if (payment.provider === "stripe" && process.env.STRIPE_SECRET_KEY && plan.stripePriceId) {
        const params = new URLSearchParams({
          mode: "subscription",
          success_url: `${process.env.PUBLIC_APP_URL || "http://localhost:4173"}/#/billing?payment=${payment.id}&status=success`,
          cancel_url: `${process.env.PUBLIC_APP_URL || "http://localhost:4173"}/#/pricing`,
          "line_items[0][price]": plan.stripePriceId,
          "line_items[0][quantity]": "1",
          client_reference_id: payment.id,
          customer_email: user.email
        });
        const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
          body: params
        });
        const payload = await stripe.json().catch(() => ({}));
        if (!stripe.ok) return json(res, 400, { error: payload.error?.message || "Stripe checkout failed" });
        payment.externalId = payload.id;
        payment.checkoutUrl = payload.url;
        await saveDb(db);
        return json(res, 200, { payment, checkoutUrl: payload.url, mode: "stripe" });
      }
      payment.checkoutUrl = `/#/billing?payment=${payment.id}&status=success`;
      await saveDb(db);
      return json(res, 200, { payment, checkoutUrl: payment.checkoutUrl, mode: "local-test" });
    }

    if (method === "POST" && pathname === "/api/billing/confirm") {
      if (!requireUser(res, user)) return;
      const body = await readBody(req);
      const payment = db.payments.find((item) => item.id === body.paymentId && item.userId === user.id);
      if (!payment) return json(res, 404, { error: "Payment not found" });
      const plan = (db.plans || plans).find((item) => item.id === payment.plan) || plans[0];
      payment.status = "paid";
      payment.confirmedAt = now();
      const subscription = { id: id("sub"), userId: user.id, plan: plan.id, status: "active", credits: plan.credits, provider: payment.provider, paymentId: payment.id, createdAt: now(), renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() };
      user.subscription = { plan: plan.id, status: "active", credits: plan.credits, renewsAt: subscription.renewsAt };
      db.subscriptions = db.subscriptions.filter((item) => item.userId !== user.id || item.status !== "active");
      db.subscriptions.unshift(subscription);
      db.invoices.unshift({ id: id("inv"), userId: user.id, paymentId: payment.id, plan: plan.id, amount: payment.amount, currency: payment.currency, status: "paid", createdAt: now() });
      await safeGrantCredits(user.id, plan.credits, {
        source: "subscription",
        plan: plan.id,
        paymentId: payment.id
      });
      log(db, "billing", `确认订阅：${user.email} -> ${plan.name}`);
      await saveDb(db);
      return json(res, 200, { subscription, payment, user: sanitizeUser(user) });
    }

    if (method === "POST" && pathname === "/api/billing/manage") {
      if (!requireUser(res, user)) return;
      return json(res, 200, { mode: process.env.STRIPE_SECRET_KEY ? "stripe-config-required" : "local-test", message: "订阅管理已启用：可升级、降级或取消。Stripe Portal 可在配置 customer id 后接入。", subscription: user.subscription });
    }

    if (method === "POST" && pathname === "/api/subscription/cancel") {
      if (!requireUser(res, user)) return;
      user.subscription = { ...(user.subscription || {}), status: "canceled", canceledAt: now() };
      db.subscriptions.forEach((sub) => {
        if (sub.userId === user.id && sub.status === "active") sub.status = "canceled";
      });
      log(db, "billing", `取消订阅：${user.email}`);
      await saveDb(db);
      return json(res, 200, { user: sanitizeUser(user) });
    }

    if (method === "POST" && pathname === "/api/settings") {
      if (!requireAdmin(res, user)) return;
      const body = await readBody(req);
      db.settings = { ...db.settings, ...(body.settings || {}) };
      log(db, "settings", "保存工作区设置");
      await saveDb(db);
      return json(res, 200, { settings: db.settings });
    }

    if (method === "POST" && pathname === "/api/pricing/select") {
      if (!requireUser(res, user)) return;
      const body = await readBody(req);
      db.settings.subscription = body.plan || "Pro";
      const invoice = { id: id("inv"), plan: db.settings.subscription, amount: body.amount || 0, status: "paid-local", createdAt: now() };
      db.invoices.unshift(invoice);
      log(db, "billing", `订阅方案切换为：${db.settings.subscription}`);
      await saveDb(db);
      return json(res, 200, { settings: db.settings, invoice });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof ApiError) {
      return json(res, error.statusCode, error.toJSON());
    }
    json(res, 500, { error: error.message || "Server error" });
  }
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const entry = decoded === "/admin" || decoded.startsWith("/admin/") ? "/admin.html" : decoded === "/" ? "/index.html" : decoded;
  const normalized = path.normalize(entry);
  const absolute = path.join(root, normalized);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolute;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/v2/")) {
    await apiV2Handler(req, res, url.pathname);
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) {
    await api(req, res, url.pathname);
    return;
  }

  const filePath = safePath(url.pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-store" });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": mime[ext] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  });
});

ensureDb().then(() => {
  server.listen(port, () => {
    console.log(`SellerCanvas AI production app running at http://localhost:${port}`);
  });
});
