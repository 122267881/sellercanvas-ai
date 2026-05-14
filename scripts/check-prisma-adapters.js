"use strict";

const api = require("../apps/api/src");
const { JOB_TYPES } = require("../workers/ai/src/jobTypes");

async function run() {
  const prisma = createFakePrisma();
  await verifyCreditAdapter(prisma);
  await verifyJobAdapter(prisma);
  await verifyStripePaymentAdapter(prisma);
  console.log("Prisma adapters OK");
}

async function verifyCreditAdapter(prisma) {
  const repository = api.createPrismaCreditRepository({ prisma });
  const creditService = api.createCreditService({ repository });

  await creditService.grant("user_prisma", 100, { source: "stripe" });
  await creditService.reserve("user_prisma", 80, { jobId: "job_prisma" });
  await creditService.consumeReserved("user_prisma", 80, { jobId: "job_prisma" });

  assertBalance(await creditService.getBalance("user_prisma"), { balance: 20, reserved: 0, available: 20 });
  const ledger = await repository.listLedger("user_prisma");
  assert(ledger.length === 3, "Prisma credit ledger should persist three entries");
  assert(ledger[0].type === "GRANT" && ledger[2].type === "CONSUME", "Prisma credit ledger order should be stable");
}

async function verifyJobAdapter(prisma) {
  prisma.__setProjectUser("project_prisma", "user_job_prisma");

  const creditRepository = api.createPrismaCreditRepository({ prisma });
  const creditService = api.createCreditService({ repository: creditRepository });
  const jobRepository = api.createPrismaJobRepository({ prisma });
  const jobService = api.createJobService({ jobRepository, creditService });

  await creditService.grant("user_job_prisma", 100, { source: "test" });
  const job = await jobService.createJob({
    userId: "user_job_prisma",
    projectId: "project_prisma",
    type: JOB_TYPES.IMAGE_GENERATION,
    input: { count: 4 }
  });

  assert(job.id && job.creditAmount === 80, "Prisma job adapter should create credit-priced job");
  assertBalance(await creditService.getBalance("user_job_prisma"), { balance: 100, reserved: 80, available: 20 });

  const succeeded = await jobService.markSucceeded(job.id, { assetCount: 4 });
  assert(succeeded.status === "SUCCEEDED", "Prisma job adapter should update job status");
  assertBalance(await creditService.getBalance("user_job_prisma"), { balance: 20, reserved: 0, available: 20 });
}

async function verifyStripePaymentAdapter(prisma) {
  const repository = api.createStripePaymentRepository({ prisma });
  const creditRepository = api.createPrismaCreditRepository({ prisma });
  const creditService = api.createCreditService({ repository: creditRepository });
  const handler = api.createStripeWebhookHandler({
    creditService,
    paymentRepository: repository,
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });

  const checkout = {
    id: "evt_prisma_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_prisma",
        subscription: "sub_prisma",
        status: "complete",
        payment_status: "paid",
        metadata: { userId: "user_stripe_prisma", plan: "pro" },
        line_items: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  };

  const invoice = {
    id: "evt_prisma_invoice",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_prisma",
        subscription: "sub_prisma",
        metadata: { userId: "user_stripe_prisma" },
        lines: { data: [{ price: { id: "price_pro" } }] }
      }
    }
  };

  const [checkoutResult, invoiceResult] = await Promise.allSettled([handler(checkout), handler(invoice)]);
  const granted = [checkoutResult, invoiceResult]
    .filter((item) => item.status === "fulfilled")
    .reduce((sum, item) => sum + item.value.credits, 0);
  assert(granted === 1200, "Prisma payment adapter should grant once for checkout+invoice pair");
  assertBalance(await creditService.getBalance("user_stripe_prisma"), { balance: 1200, reserved: 0, available: 1200 });

  const duplicate = await handler({ ...invoice, id: "evt_prisma_invoice_retry" });
  assert(duplicate.action === "duplicate_grant", "Prisma payment adapter should identify duplicate grant");

  const failingRepository = api.createStripePaymentRepository({ prisma: createFakePrisma() });
  const failingHandler = api.createStripeWebhookHandler({
    creditService: { async grant() { throw new Error("grant failed"); } },
    paymentRepository: failingRepository,
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });
  await expectRejects(() => failingHandler({ ...checkout, id: "evt_prisma_failure" }), "grant failed");
  assert(!(await failingRepository.hasEvent("evt_prisma_failure")), "failed Prisma webhook grant should not record event");
}

function createFakePrisma() {
  const now = () => new Date();
  const ids = {};
  const tables = {
    creditAccounts: [],
    creditLedgers: [],
    generationJobs: [],
    stripeEvents: [],
    creditGrants: [],
    projectUsers: new Map()
  };

  function id(prefix) {
    ids[prefix] = (ids[prefix] || 0) + 1;
    return `${prefix}_${ids[prefix]}`;
  }

  function uniqueError(message = "Unique constraint failed") {
    const error = new Error(message);
    error.code = "P2002";
    return error;
  }

  function notFoundError(message = "Record not found") {
    const error = new Error(message);
    error.code = "P2025";
    return error;
  }

  const prisma = {
    __setProjectUser(projectId, userId) {
      tables.projectUsers.set(projectId, userId);
    },
    creditAccount: {
      async findUnique({ where, select }) {
        const account = tables.creditAccounts.find((item) => matchesWhere(item, where));
        return account ? applySelect(clone(account), select) : null;
      },
      async create({ data }) {
        if (tables.creditAccounts.some((item) => item.userId === data.userId)) throw uniqueError();
        const record = { id: id("ca"), createdAt: now(), updatedAt: now(), ...clone(data) };
        tables.creditAccounts.push(record);
        return clone(record);
      },
      async update({ where, data }) {
        const account = tables.creditAccounts.find((item) => matchesWhere(item, where));
        if (!account) throw notFoundError();
        Object.assign(account, clone(data), { updatedAt: now() });
        return clone(account);
      }
    },
    creditLedger: {
      async create({ data }) {
        const record = { id: id("cl"), createdAt: now(), ...clone(data) };
        tables.creditLedgers.push(record);
        return clone(record);
      },
      async findMany({ where, orderBy } = {}) {
        return sortRows(tables.creditLedgers.filter((item) => matchesWhere(item, where)), orderBy).map(clone);
      }
    },
    generationJob: {
      async create({ data, include }) {
        const record = { id: id("job"), createdAt: now(), updatedAt: now(), ...clone(data) };
        tables.generationJobs.push(record);
        return includeProject(clone(record), include, tables);
      },
      async update({ where, data, include }) {
        const job = tables.generationJobs.find((item) => matchesWhere(item, where));
        if (!job) throw notFoundError();
        Object.assign(job, clone(data), { updatedAt: now() });
        return includeProject(clone(job), include, tables);
      },
      async findUnique({ where, include }) {
        const job = tables.generationJobs.find((item) => matchesWhere(item, where));
        return job ? includeProject(clone(job), include, tables) : null;
      },
      async findMany({ where, include, orderBy } = {}) {
        return sortRows(tables.generationJobs.filter((item) => matchesWhere(item, where)), orderBy)
          .map((job) => includeProject(clone(job), include, tables));
      }
    },
    stripeEvent: {
      async findUnique({ where, select }) {
        const event = tables.stripeEvents.find((item) => matchesWhere(item, where));
        return event ? applySelect(clone(event), select) : null;
      },
      async create({ data }) {
        if (tables.stripeEvents.some((item) => item.providerEventId === data.providerEventId)) throw uniqueError();
        const record = { id: id("se"), createdAt: now(), updatedAt: now(), ...clone(data) };
        tables.stripeEvents.push(record);
        return clone(record);
      }
    },
    creditGrant: {
      async create({ data }) {
        if (tables.creditGrants.some((item) => item.grantKey === data.grantKey)) throw uniqueError();
        const record = { id: id("cg"), createdAt: now(), updatedAt: now(), ...clone(data) };
        tables.creditGrants.push(record);
        return clone(record);
      },
      async findUnique({ where }) {
        const grant = tables.creditGrants.find((item) => matchesWhere(item, where));
        return grant ? clone(grant) : null;
      },
      async update({ where, data }) {
        const grant = tables.creditGrants.find((item) => matchesWhere(item, where));
        if (!grant) throw notFoundError();
        Object.assign(grant, clone(data), { updatedAt: now() });
        return clone(grant);
      },
      async delete({ where }) {
        const index = tables.creditGrants.findIndex((item) => matchesWhere(item, where));
        if (index === -1) throw notFoundError();
        const [deleted] = tables.creditGrants.splice(index, 1);
        return clone(deleted);
      }
    }
  };

  return prisma;
}

function includeProject(job, include, tables) {
  if (include && include.project) {
    job.project = { userId: tables.projectUsers.get(job.projectId) || job.userId || "unknown_user" };
  }
  return job;
}

function matchesWhere(item, where = {}) {
  return Object.entries(where || {}).every(([key, value]) => item[key] === value);
}

function applySelect(item, select) {
  if (!select) return item;
  const selected = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) selected[key] = item[key];
  }
  return selected;
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const [[field, direction]] = Object.entries(orderBy);
  return [...rows].sort((a, b) => {
    const left = a[field] instanceof Date ? a[field].getTime() : a[field];
    const right = b[field] instanceof Date ? b[field].getTime() : b[field];
    return direction === "desc" ? right - left : left - right;
  });
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
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
