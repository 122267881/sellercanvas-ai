"use strict";

const { Readable, Writable } = require("stream");
const api = require("../apps/api/src");
const { JOB_TYPES } = require("../workers/ai/src/jobTypes");

async function run() {
  const context = api.createAppContext({
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });
  const users = {
    admin: { id: "admin_http", role: "admin" },
    customer: { id: "user_http", role: "customer" },
    other: { id: "other_http", role: "customer" }
  };
  const handler = api.createApiV2HttpHandler({
    context,
    authenticate(req) {
      return users[req.headers["x-test-user"]] || null;
    },
    isInternal(req) {
      return req.headers["x-worker-secret"] === "test-worker-secret";
    }
  });

  let response = await request(handler, "GET", "/api/v2/credits/balance", null, { "x-test-user": "customer" });
  assert(response.statusCode === 200, "customer balance route should be OK");
  assertBalance(response.body.balance, { balance: 0, reserved: 0, available: 0 });

  response = await request(handler, "POST", "/api/v2/admin/credits/grant", {
    userId: "user_http",
    amount: 100,
    reason: "http_test"
  }, { "x-test-user": "admin" });
  assert(response.statusCode === 200, "admin grant route should be OK");

  response = await request(handler, "POST", "/api/v2/jobs", {
    projectId: "project_http",
    type: JOB_TYPES.IMAGE_GENERATION,
    input: { count: 4 }
  }, { "x-test-user": "customer" });
  assert(response.statusCode === 200, "customer create job route should be OK");
  const jobId = response.body.job.id;

  response = await request(handler, "GET", `/api/v2/jobs/${jobId}`, null, { "x-test-user": "other" });
  assert(response.statusCode === 403, "other customer should not read job");

  response = await request(handler, "POST", `/api/v2/internal/jobs/${jobId}/succeeded`, {
    output: { assetCount: 4 }
  }, { "x-worker-secret": "test-worker-secret" });
  assert(response.statusCode === 200 && response.body.job.status === "SUCCEEDED", "worker should mark job succeeded");

  response = await request(handler, "GET", "/api/v2/credits/balance", null, { "x-test-user": "customer" });
  assertBalance(response.body.balance, { balance: 20, reserved: 0, available: 20 });

  response = await request(handler, "POST", "/api/v2/stripe/webhook", {
    id: "evt_http_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_http",
        subscription: "sub_http",
        status: "complete",
        payment_status: "paid",
        metadata: { userId: "stripe_http", plan: "pro" },
        line_items: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  });
  assert(response.statusCode === 200 && response.body.credits === 1200, "Stripe webhook route should grant credits");

  response = await request(handler, "GET", "/api/v2/credits/balance", null, { "x-test-user": "stripe" });
  assert(response.statusCode === 401, "unknown user should not read balance");

  response = await request(handler, "POST", "/api/v2/jobs", {
    projectId: "project_no_credits",
    type: JOB_TYPES.IMAGE_GENERATION,
    input: { count: 4 }
  }, { "x-test-user": "other" });
  assert(response.statusCode === 402, "insufficient credits should return 402");

  console.log("API v2 HTTP OK");
}

async function request(handler, method, pathname, body, headers = {}) {
  const req = new Readable({ read() {} });
  req.method = method;
  req.headers = headers;
  if (body !== null && body !== undefined) req.push(JSON.stringify(body));
  req.push(null);

  const chunks = [];
  const res = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    }
  });
  res.writeHead = (statusCode, responseHeaders = {}) => {
    res.statusCode = statusCode;
    res.headers = responseHeaders;
  };

  await handler(req, res, pathname);
  const text = Buffer.concat(chunks).toString("utf8");
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: text ? JSON.parse(text) : null
  };
}

function assertBalance(actual, expected) {
  assert(actual.balance === expected.balance, `expected balance ${expected.balance}, got ${actual.balance}`);
  assert(actual.reserved === expected.reserved, `expected reserved ${expected.reserved}, got ${actual.reserved}`);
  assert(actual.available === expected.available, `expected available ${expected.available}, got ${actual.available}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
