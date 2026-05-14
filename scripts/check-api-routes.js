"use strict";

const { execFileSync } = require("child_process");
const path = require("path");
const api = require("../apps/api/src");
const { JOB_TYPES } = require("../workers/ai/src/jobTypes");

const filesToCheck = [
  "apps/api/src/appContext.js",
  "apps/api/src/security/permissions.js",
  "apps/api/src/billing/paymentRepository.js",
  "apps/api/src/routes/credits.js",
  "apps/api/src/routes/jobs.js",
  "apps/api/src/routes/stripe.js"
];

for (const file of filesToCheck) {
  execFileSync(process.execPath, ["--check", path.join(process.cwd(), file)], { stdio: "inherit" });
}

async function run() {
  const context = api.createAppContext({
    plans: { pro: { id: "pro", credits: 1200, stripePriceId: "price_pro" } }
  });
  const creditRoutes = api.createCreditRoutes({ creditService: context.services.creditService });
  const jobRoutes = api.createJobRoutes({
    jobService: context.services.jobService,
    jobRepository: context.repositories.jobRepository
  });
  const stripeRoutes = api.createStripeRoutes({ stripeWebhookHandler: context.services.stripeWebhookHandler });

  const admin = { id: "admin_1", role: "admin" };
  const customer = { id: "user_route", role: "customer" };

  await creditRoutes.grantCredits({
    user: admin,
    body: { userId: customer.id, amount: 100, reason: "route_test" }
  });
  let balance = await creditRoutes.getBalance({ user: customer });
  assertBalance(balance.balance, { balance: 100, reserved: 0, available: 100 });

  const created = await jobRoutes.createJob({
    user: customer,
    body: { projectId: "project_route", type: JOB_TYPES.IMAGE_GENERATION, input: { count: 4 } }
  });
  assert(created.job.creditAmount === 80, "route-created image job should cost 80 credits");
  balance = await creditRoutes.getBalance({ user: customer });
  assertBalance(balance.balance, { balance: 100, reserved: 80, available: 20 });

  const visible = await jobRoutes.getJob({ user: customer, params: { jobId: created.job.id } });
  assert(visible.job.id === created.job.id, "customer should access own job");

  await expectRejects(
    () => jobRoutes.getJob({ user: { id: "other_user", role: "customer" }, params: { jobId: created.job.id } }),
    "Cannot access this job"
  );

  await jobRoutes.markFailed({
    internal: true,
    params: { jobId: created.job.id },
    body: { error: "provider timeout" }
  });
  balance = await creditRoutes.getBalance({ user: customer });
  assertBalance(balance.balance, { balance: 100, reserved: 0, available: 100 });

  const stripeResult = await stripeRoutes.handleVerifiedEvent({
    body: {
      id: "evt_route_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_route",
          subscription: "sub_route",
          status: "complete",
          payment_status: "paid",
          metadata: { userId: "user_stripe_route", plan: "pro" },
          line_items: { data: [{ price: { id: "price_pro" } }] }
        }
      }
    }
  });
  assert(stripeResult.credits === 1200, "stripe route should grant plan credits");
  const stripeBalance = await creditRoutes.getBalance({ user: { id: "user_stripe_route", role: "customer" } });
  assertBalance(stripeBalance.balance, { balance: 1200, reserved: 0, available: 1200 });

  console.log("API routes OK");
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
