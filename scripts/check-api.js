"use strict";

const { execFileSync } = require("child_process");
const path = require("path");

const api = require("../apps/api/src");
const { JOB_TYPES } = require("../workers/ai/src/jobTypes");

const filesToCheck = [
  "apps/api/src/config.js",
  "apps/api/src/http/errors.js",
  "apps/api/src/billing/creditRepository.js",
  "apps/api/src/billing/creditService.js",
  "apps/api/src/billing/stripeWebhook.js",
  "apps/api/src/jobs/jobRepository.js",
  "apps/api/src/jobs/jobService.js",
  "apps/api/src/index.js",
  "workers/ai/src/jobTypes.js"
];

for (const file of filesToCheck) {
  execFileSync(process.execPath, ["--check", path.join(process.cwd(), file)], { stdio: "inherit" });
}

async function run() {
  await verifyConfigAndErrors();
  await verifyCredits();
  await verifyJobs();
  await verifyStripeIdempotency();
  console.log("API foundation OK");
}

async function verifyConfigAndErrors() {
  const config = api.loadConfig({});
  assert(config.publicAppUrl === "http://localhost:4173", "default public app URL should be local");
  assert(new api.PaymentRequiredError("upgrade").statusCode === 402, "PaymentRequiredError should be 402");
}

async function verifyCredits() {
  const repository = makeAsyncCreditRepository(api.createInMemoryCreditRepository());
  const creditService = api.createCreditService({ repository });

  await creditService.grant("user_1", 100, { source: "test" });
  await creditService.reserve("user_1", 80, { jobId: "job_1" });
  assertBalance(await creditService.getBalance("user_1"), { balance: 100, reserved: 80, available: 20 });

  await creditService.refundReserved("user_1", 30, { jobId: "job_1" });
  assertBalance(await creditService.getBalance("user_1"), { balance: 100, reserved: 50, available: 50 });

  await creditService.consumeReserved("user_1", 50, { jobId: "job_1" });
  assertBalance(await creditService.getBalance("user_1"), { balance: 50, reserved: 0, available: 50 });

  const ledger = await repository.listLedger("user_1");
  assert(ledger.map((entry) => entry.type).join(",") === "GRANT,RESERVE,REFUND,CONSUME", "credit ledger should record all operations");
}

function makeAsyncCreditRepository(repository) {
  return {
    async getAccountByUserId(userId) {
      return repository.getAccountByUserId(userId);
    },
    async createAccount(input) {
      return repository.createAccount(input);
    },
    async saveAccount(account) {
      return repository.saveAccount(account);
    },
    async appendLedger(entry) {
      return repository.appendLedger(entry);
    },
    async listLedger(userId) {
      return repository.listLedger(userId);
    }
  };
}

async function verifyJobs() {
  const creditRepository = api.createInMemoryCreditRepository();
  const creditService = api.createCreditService({ repository: creditRepository });
  const jobRepository = api.createInMemoryJobRepository();
  const jobService = api.createJobService({ jobRepository, creditService });

  await creditService.grant("user_jobs", 100, { source: "test" });
  const job = await jobService.createJob({
    userId: "user_jobs",
    projectId: "project_1",
    type: JOB_TYPES.IMAGE_GENERATION,
    input: { assetTypes: ["main", "lifestyle", "dimension", "marketing"] }
  });

  assert(job.creditAmount === 80, "image generation bundle should cost 80 credits");
  assertBalance(await creditService.getBalance("user_jobs"), { balance: 100, reserved: 80, available: 20 });

  const succeeded = await jobService.markSucceeded(job.id, { assetCount: 4 });
  assert(succeeded.status === "SUCCEEDED", "job should be succeeded");
  assertBalance(await creditService.getBalance("user_jobs"), { balance: 20, reserved: 0, available: 20 });

  const failingJob = await jobService.createJob({
    userId: "user_jobs",
    projectId: "project_1",
    type: JOB_TYPES.EXPORT_PACKAGING,
    input: { export: true }
  });
  await jobService.markFailed(failingJob.id, "provider timeout");
  assertBalance(await creditService.getBalance("user_jobs"), { balance: 20, reserved: 0, available: 20 });
}

async function verifyStripeIdempotency() {
  const creditRepository = api.createInMemoryCreditRepository();
  const creditService = api.createCreditService({ repository: creditRepository });
  const seenEvents = new Set();
  const seenGrants = new Map();
  const paymentRepository = {
    async hasEvent(eventId) {
      return seenEvents.has(eventId);
    },
    async recordEvent(event) {
      if (seenEvents.has(event.id)) return false;
      seenEvents.add(event.id);
      return true;
    },
    async recordGrant(record) {
      if (seenGrants.has(record.grantKey)) return false;
      seenGrants.set(record.grantKey, { ...record });
      return true;
    },
    async getGrant(grantKey) {
      return seenGrants.get(grantKey) || null;
    },
    async finalizeGrant(grantKey, patch) {
      const current = seenGrants.get(grantKey);
      seenGrants.set(grantKey, { ...(current || { grantKey }), ...patch });
      return true;
    },
    async releaseGrant(grantKey) {
      seenGrants.delete(grantKey);
    }
  };

  const handler = api.createStripeWebhookHandler({
    creditService,
    paymentRepository,
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });

  const event = {
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        subscription: "sub_1",
        status: "complete",
        payment_status: "paid",
        metadata: { userId: "user_stripe", plan: "pro" },
        line_items: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  };

  const first = await handler(event);
  const duplicate = await handler(event);
  const invoicePair = await handler({
    id: "evt_2",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_1",
        subscription: "sub_1",
        metadata: { userId: "user_stripe", plan: "pro" },
        lines: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  });

  assert(first.credits === 1200, "first Stripe event should grant credits");
  assert(duplicate.action === "duplicate" && duplicate.credits === 0, "duplicate Stripe event should not grant");
  assert(invoicePair.action === "duplicate_grant" && invoicePair.credits === 0, "checkout and invoice pair should not double grant credits");
  assertBalance(await creditService.getBalance("user_stripe"), { balance: 1200, reserved: 0, available: 1200 });

  const raceCreditRepository = api.createInMemoryCreditRepository();
  const raceCreditService = api.createCreditService({ repository: raceCreditRepository });
  const raceRepository = createRacePaymentRepository();
  const raceHandler = api.createStripeWebhookHandler({
    creditService: raceCreditService,
    paymentRepository: raceRepository,
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });
  const raceCheckoutEvent = {
    id: "evt_race_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_race",
        subscription: "sub_race",
        status: "complete",
        payment_status: "paid",
        metadata: { userId: "user_race", plan: "pro" },
        line_items: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  };
  const raceInvoiceEvent = {
    id: "evt_race_invoice",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_race",
        subscription: "sub_race",
        metadata: { userId: "user_race", plan: "pro" },
        lines: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  };
  const [raceCheckoutResult, raceInvoiceResult] = await Promise.allSettled([
    raceHandler(raceCheckoutEvent),
    raceHandler(raceInvoiceEvent)
  ]);
  const raceResults = [raceCheckoutResult, raceInvoiceResult];
  const raceGranted = raceResults
    .filter((item) => item.status === "fulfilled")
    .reduce((sum, item) => sum + item.value.credits, 0);
  const raceRetryEvent = raceCheckoutResult.status === "rejected" ? raceCheckoutEvent : raceInvoiceEvent;
  const raceRetry = await raceHandler({ ...raceRetryEvent, id: `${raceRetryEvent.id}_retry` });
  assert(raceGranted === 1200, "one concurrent Stripe event should grant credits");
  assert(raceRetry.action === "duplicate_grant" && raceRetry.credits === 0, "concurrent loser retry should settle as duplicate grant");
  assertBalance(await raceCreditService.getBalance("user_race"), { balance: 1200, reserved: 0, available: 1200 });

  const mixedCreditRepository = api.createInMemoryCreditRepository();
  const mixedCreditService = api.createCreditService({ repository: mixedCreditRepository });
  const mixedHandler = api.createStripeWebhookHandler({
    creditService: mixedCreditService,
    paymentRepository: createRacePaymentRepository(),
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });
  const [mixedCheckout, mixedInvoice] = await Promise.allSettled([
    mixedHandler({
      ...raceCheckoutEvent,
      id: "evt_mixed_checkout",
      data: { object: { ...raceCheckoutEvent.data.object, subscription: "sub_mixed", metadata: { userId: "user_mixed", plan: "pro" } } }
    }),
    mixedHandler({
      id: "evt_mixed_invoice",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_mixed",
          subscription: "sub_mixed",
          metadata: { userId: "user_mixed" },
          lines: { data: [{ price: { id: "price_pro" } }] }
        }
      }
    })
  ]);
  const mixedGranted = [mixedCheckout, mixedInvoice]
    .filter((item) => item.status === "fulfilled")
    .reduce((sum, item) => sum + item.value.credits, 0);
  assert(mixedGranted === 1200, "canonical plan id should prevent metadata/price grant-key mismatch");
  assertBalance(await mixedCreditService.getBalance("user_mixed"), { balance: 1200, reserved: 0, available: 1200 });

  const failingCreditService = {
    async grant() {
      throw new Error("grant failed");
    }
  };
  const recordedAfterFailure = new Set();
  const claimedAfterFailure = new Map();
  const failingHandler = api.createStripeWebhookHandler({
    creditService: failingCreditService,
    paymentRepository: {
      async hasEvent(eventId) {
        return recordedAfterFailure.has(eventId);
      },
      async recordEvent(eventToRecord) {
        recordedAfterFailure.add(eventToRecord.id);
        return true;
      },
      async recordGrant(record) {
        if (claimedAfterFailure.has(record.grantKey)) return false;
        claimedAfterFailure.set(record.grantKey, { ...record });
        return true;
      },
      async getGrant(grantKey) {
        return claimedAfterFailure.get(grantKey) || null;
      },
      async finalizeGrant(grantKey, patch) {
        const current = claimedAfterFailure.get(grantKey);
        claimedAfterFailure.set(grantKey, { ...(current || { grantKey }), ...patch });
        return true;
      },
      async releaseGrant(grantKey) {
        claimedAfterFailure.delete(grantKey);
      }
    },
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });
  await expectRejects(() => failingHandler({ ...event, id: "evt_failure" }), "grant failed");
  assert(!recordedAfterFailure.has("evt_failure"), "failed grant should not finalize Stripe event idempotency");
  assert(claimedAfterFailure.size === 0, "failed grant should release Stripe grant claim");
}

function createRacePaymentRepository() {
  const events = new Set();
  const grants = new Map();
  return {
    async hasEvent(eventId) {
      return events.has(eventId);
    },
    async recordEvent(event) {
      if (events.has(event.id)) return false;
      events.add(event.id);
      return true;
    },
    async recordGrant(record) {
      if (grants.has(record.grantKey)) return false;
      grants.set(record.grantKey, { ...record });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    },
    async getGrant(grantKey) {
      return grants.get(grantKey) || null;
    },
    async finalizeGrant(grantKey, patch) {
      const current = grants.get(grantKey);
      grants.set(grantKey, { ...(current || { grantKey }), ...patch });
      return true;
    },
    async releaseGrant(grantKey) {
      grants.delete(grantKey);
    }
  };
}

async function expectRejects(fn, message) {
  try {
    await fn();
  } catch (error) {
    assert(error.message === message, `expected rejection ${message}, got ${error.message}`);
    return;
  }
  throw new Error(`Expected rejection: ${message}`);
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
