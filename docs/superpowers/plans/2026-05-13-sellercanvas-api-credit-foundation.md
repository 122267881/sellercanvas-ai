# SellerCanvas API Credit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second migration slice for the production SaaS foundation: API service boundaries, credit accounting service, Stripe webhook handler skeleton, and AI job creation contract.

**Architecture:** Keep the legacy root app running while adding production-oriented CommonJS modules under `apps/api/src` and `workers/ai/src`. The modules are dependency-light and testable without a live database; database writes are abstracted through repository interfaces so Prisma can be wired in the next slice.

**Tech Stack:** Node.js 18+, CommonJS modules, existing shared/billing/ai-core packages, Prisma schema prepared in the previous slice, no destructive legacy changes.

---

## File Structure

Create:

- `apps/api/src/config.js` - environment parsing and production config.
- `apps/api/src/http/errors.js` - reusable API error types.
- `apps/api/src/billing/creditRepository.js` - in-memory repository contract for credit accounts and ledger.
- `apps/api/src/billing/creditService.js` - grant, reserve, consume, refund operations.
- `apps/api/src/billing/stripeWebhook.js` - Stripe webhook event handler skeleton with idempotency.
- `apps/api/src/jobs/jobRepository.js` - in-memory job repository contract.
- `apps/api/src/jobs/jobService.js` - credit-aware AI job creation and completion/refund helpers.
- `workers/ai/src/jobTypes.js` - supported AI job type constants and credit operation mapping.
- `apps/api/src/index.js` - export surface for future API routes.

Modify:

- `package.json` - add `check:api` and include API/worker module syntax checks.

Verify:

- `npm.cmd run check`
- `npm.cmd run check:architecture`
- `npm.cmd run check:api`

---

### Task 1: API Config and Errors

**Files:**

- Create: `apps/api/src/config.js`
- Create: `apps/api/src/http/errors.js`

Steps:

1. Create `apps/api/src` and `apps/api/src/http`.
2. Implement `loadConfig(env = process.env)` with required values:
   - `databaseUrl`
   - `redisUrl`
   - `publicAppUrl`
   - `stripeSecretKey`
   - `stripeWebhookSecret`
   - `workerInternalSecret`
   - `storage`
3. Implement `ApiError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `PaymentRequiredError`, and `InternalError`.
4. Verify modules load with `node -e "const { loadConfig } = require('./apps/api/src/config'); const { PaymentRequiredError } = require('./apps/api/src/http/errors'); console.log(Boolean(loadConfig({}).publicAppUrl), new PaymentRequiredError('x').statusCode)"`.

### Task 2: Credit Repository and Service

**Files:**

- Create: `apps/api/src/billing/creditRepository.js`
- Create: `apps/api/src/billing/creditService.js`

Steps:

1. Create `apps/api/src/billing`.
2. Implement `createInMemoryCreditRepository()` with:
   - `getAccountByUserId(userId)`
   - `createAccount({ userId, balance })`
   - `saveAccount(account)`
   - `appendLedger(entry)`
   - `listLedger(userId)`
3. Implement `createCreditService({ repository })` with:
   - `ensureAccount(userId)`
   - `grant(userId, amount, meta)`
   - `reserve(userId, amount, meta)`
   - `consumeReserved(userId, amount, meta)`
   - `refundReserved(userId, amount, meta)`
   - `getBalance(userId)`
4. Service must use `packages/billing/src/creditLedger.js`.
5. Verify reserve/consume/refund behavior with a node smoke test.

### Task 3: AI Job Type Contract and Job Service

**Files:**

- Create: `workers/ai/src/jobTypes.js`
- Create: `apps/api/src/jobs/jobRepository.js`
- Create: `apps/api/src/jobs/jobService.js`

Steps:

1. Define job types:
   - `IMAGE_ANALYSIS`
   - `PROMPT_GENERATION`
   - `IMAGE_GENERATION`
   - `LISTING_COPY_GENERATION`
   - `EXPORT_PACKAGING`
2. Map each job type to the correct credit operation from `packages/shared/src/creditPricing.js`.
3. Implement `createInMemoryJobRepository()` with create/update/get/list.
4. Implement `createJobService({ jobRepository, creditService })` with:
   - `createJob({ userId, projectId, type, input })`
   - `markSucceeded(jobId, output)`
   - `markFailed(jobId, error)`
5. `createJob` must reserve credits. `markSucceeded` consumes reserved credits. `markFailed` refunds reserved credits.
6. Verify creating an image-generation bundle job reserves 80 credits and success consumes them.

### Task 4: Stripe Webhook Handler Skeleton

**Files:**

- Create: `apps/api/src/billing/stripeWebhook.js`

Steps:

1. Implement `createStripeWebhookHandler({ creditService, paymentRepository, plans })`.
2. Accept already-verified event objects in this slice.
3. Handle:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. Enforce idempotency through `paymentRepository.hasEvent(event.id)` and `recordEvent(event)`.
5. Grant plan credits only once for paid checkout/invoice events.
6. Return structured result `{ handled, action, userId, credits }`.
7. Verify duplicate event does not grant credits twice.

### Task 5: API Export Surface and Checks

**Files:**

- Create: `apps/api/src/index.js`
- Modify: `package.json`

Steps:

1. Export config, errors, credit service, job service, and Stripe webhook modules from `apps/api/src/index.js`.
2. Add `check:api` script that syntax-checks every new API/worker module and runs smoke tests for:
   - credit grant/reserve/consume/refund
   - job create/success/failure
   - Stripe duplicate idempotency
3. Update `check` to include `npm run check:api` or keep `check:api` separate if command recursion is awkward on Windows.
4. Run:
   - `npm.cmd run check`
   - `npm.cmd run check:architecture`
   - `npm.cmd run check:api`

---

## Self-Review

This plan intentionally avoids wiring HTTP routes or Prisma client writes. It creates the business services that future routes will call and keeps them testable with in-memory repositories. The next slice can replace repositories with Prisma implementations, then expose these services through API endpoints.
