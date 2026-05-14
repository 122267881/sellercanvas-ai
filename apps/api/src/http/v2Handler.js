"use strict";

const { ApiError, BadRequestError } = require("./errors");
const { createCreditRoutes } = require("../routes/credits");
const { createJobRoutes } = require("../routes/jobs");
const { createStripeRoutes } = require("../routes/stripe");

function createApiV2HttpHandler({ context, authenticate, isInternal } = {}) {
  if (!context || !context.services || !context.repositories) {
    throw new Error("API v2 context is required");
  }

  const creditRoutes = createCreditRoutes({ creditService: context.services.creditService });
  const jobRoutes = createJobRoutes({
    jobService: context.services.jobService,
    jobRepository: context.repositories.jobRepository
  });
  const stripeRoutes = createStripeRoutes({ stripeWebhookHandler: context.services.stripeWebhookHandler });

  return async function handleApiV2(req, res, pathname) {
    try {
      const body = await readJsonBody(req);
      const user = typeof authenticate === "function" ? await authenticate(req) : null;
      const request = {
        method: req.method || "GET",
        pathname,
        headers: req.headers || {},
        body,
        user,
        internal: typeof isInternal === "function" ? await isInternal(req) : false,
        params: {}
      };

      const response = await dispatch(request, { creditRoutes, jobRoutes, stripeRoutes });
      sendJson(res, 200, response);
    } catch (error) {
      sendError(res, error);
    }
  };
}

async function dispatch(request, routes) {
  const method = request.method;
  const parts = request.pathname.split("/").filter(Boolean);

  if (parts[0] !== "api" || parts[1] !== "v2") {
    throw new ApiError("Not found", { statusCode: 404, code: "NOT_FOUND" });
  }

  if (method === "GET" && parts[2] === "credits" && parts[3] === "balance" && parts.length === 4) {
    return routes.creditRoutes.getBalance(request);
  }

  if (method === "GET" && parts[2] === "admin" && parts[3] === "users" && parts[5] === "credits" && parts[6] === "balance") {
    request.params.userId = parts[4];
    return routes.creditRoutes.getBalance(request);
  }

  if (method === "POST" && parts[2] === "admin" && parts[3] === "credits" && parts[4] === "grant") {
    return routes.creditRoutes.grantCredits(request);
  }

  if (method === "POST" && parts[2] === "jobs" && parts.length === 3) {
    return routes.jobRoutes.createJob(request);
  }

  if (method === "GET" && parts[2] === "jobs" && parts[3]) {
    request.params.jobId = parts[3];
    return routes.jobRoutes.getJob(request);
  }

  if (method === "POST" && parts[2] === "internal" && parts[3] === "jobs" && parts[4] && parts[5] === "succeeded") {
    request.params.jobId = parts[4];
    return routes.jobRoutes.markSucceeded(request);
  }

  if (method === "POST" && parts[2] === "internal" && parts[3] === "jobs" && parts[4] && parts[5] === "failed") {
    request.params.jobId = parts[4];
    return routes.jobRoutes.markFailed(request);
  }

  if (method === "POST" && parts[2] === "stripe" && parts[3] === "webhook") {
    return routes.stripeRoutes.handleVerifiedEvent(request);
  }

  throw new ApiError("Not found", { statusCode: 404, code: "NOT_FOUND" });
}

async function readJsonBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return {};

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new BadRequestError("Invalid JSON body");
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  if (error instanceof ApiError) {
    sendJson(res, error.statusCode, error.toJSON());
    return;
  }

  sendJson(res, 500, {
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error"
    }
  });
}

module.exports = {
  createApiV2HttpHandler
};
