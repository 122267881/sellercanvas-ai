"use strict";

const assert = require("assert");

const baseUrl = process.env.CHECK_BASE_URL || "http://localhost:4173";
const adminEmail = process.env.ADMIN_EMAIL || "admin@sellercanvas.local";
const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!ChangeMe";

async function run() {
  await getJson("/api/health");

  const customer = createSession();
  const email = `flow-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  await customer.postJson("/api/auth/register", {
    name: "Commercial Flow User",
    email,
    password: "Password123!"
  });

  let credits = await customer.getJson("/api/v2/credits/balance");
  assert.strictEqual(credits.balance.available, 50, "new customer should receive 50 trial credits");

  const created = await customer.postJson("/api/projects", { name: "Commercial Flow Listing Kit" });
  assert.ok(created.project.id, "project should be created");

  await customer.postJson(`/api/projects/${created.project.id}/analyze`, {});
  credits = await customer.getJson("/api/v2/credits/balance");
  assert.strictEqual(credits.balance.available, 45, "analysis should cost 5 credits");

  const checkout = await customer.postJson("/api/billing/checkout", { plan: "starter", provider: "stripe" });
  assert.ok(checkout.payment.id, "checkout should create payment");
  assert.ok(["local-test", "stripe"].includes(checkout.mode), "checkout mode should be known");

  await customer.postJson("/api/billing/confirm", { paymentId: checkout.payment.id });
  credits = await customer.getJson("/api/v2/credits/balance");
  assert.strictEqual(credits.balance.available, 245, "starter subscription should grant 200 credits");

  const generated = await customer.postJson(`/api/projects/${created.project.id}/generate`, {});
  assert.strictEqual(generated.project.assets.length, 4, "image generation should create 4 assets");

  const copied = await customer.postJson(`/api/projects/${created.project.id}/copy`, { copy: null });
  assert.ok(copied.project.copy.title, "listing copy should be generated");

  const exported = await customer.postJson(`/api/projects/${created.project.id}/export`, {});
  assert.strictEqual(exported.project.status, "exported", "project should be exported");
  assert.ok(exported.export.href, "export should expose download href");

  credits = await customer.getJson("/api/v2/credits/balance");
  assert.strictEqual(credits.balance.available, 160, "generate/copy/export should deduct 85 credits after subscription");

  const bootstrap = await customer.getJson("/api/bootstrap");
  assert.ok(bootstrap.invoices.length >= 1, "customer should see invoice records");

  const invoiceResponse = await customer.get(`/api/invoices/${bootstrap.invoices[0].id}/download`);
  assert.strictEqual(invoiceResponse.status, 200, "invoice download should be available to owner");
  assert.match(invoiceResponse.headers.get("content-type") || "", /text\/html/, "invoice should be HTML");

  const manage = await customer.postJson("/api/billing/manage", {});
  assert.ok(manage.mode, "billing management should return a mode");

  const oauth = await customer.getJson("/api/auth/oauth/github/start");
  assert.strictEqual(oauth.provider, "github", "OAuth start should return provider status");

  const admin = createSession();
  await admin.postJson("/api/auth/login", { email: adminEmail, password: adminPassword });
  const overview = await admin.getJson("/api/admin/overview");
  assert.ok(overview.counts.customers >= 1, "admin overview should include customers");
  assert.ok(overview.provider, "admin overview should include provider status");

  const providerConfig = await admin.getJson("/api/admin/provider-config");
  assert.ok(providerConfig.provider, "admin provider config should load");

  const keyResult = await admin.postJson("/api/developer/api-keys", { name: "commercial-flow-test" });
  assert.ok(keyResult.secret.startsWith("sk_live_"), "developer API key should return one-time secret");

  const apiResult = await postJson("/v1/generate", {
    name: "API Commercial Flow",
    platform: "amazon",
    generateImages: false
  }, {
    authorization: `Bearer ${keyResult.secret}`
  });
  assert.ok(apiResult.project.copy.title, "external API should generate listing output");

  await admin.deleteJson(`/api/developer/api-keys/${keyResult.key.id}`);

  console.log("Commercial flow OK");
}

function createSession() {
  const jar = new Map();

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("content-type") && options.body) headers.set("content-type", "application/json");
    const cookie = [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    if (cookie) headers.set("cookie", cookie);

    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    captureCookies(response, jar);
    return response;
  }

  return {
    get: (path) => request(path),
    getJson: async (path) => parseJson(await request(path)),
    postJson: async (path, body) => parseJson(await request(path, {
      method: "POST",
      body: JSON.stringify(body)
    })),
    deleteJson: async (path) => parseJson(await request(path, { method: "DELETE" }))
  };
}

async function getJson(path) {
  return parseJson(await fetch(`${baseUrl}${path}`));
}

async function postJson(path, body, headers = {}) {
  return parseJson(await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  }));
}

async function parseJson(response) {
  const text = await response.text();
  let payload = {};
  if (text) payload = JSON.parse(text);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function captureCookies(response, jar) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return;
  for (const cookie of raw.split(/,(?=\s*[^;,]+=)/)) {
    const first = cookie.split(";")[0];
    const index = first.indexOf("=");
    if (index > 0) jar.set(first.slice(0, index).trim(), first.slice(index + 1).trim());
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
