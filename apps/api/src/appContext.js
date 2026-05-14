"use strict";

const { createCreditService } = require("./billing/creditService");
const { createInMemoryCreditRepository } = require("./billing/creditRepository");
const { createPrismaCreditRepository } = require("./billing/prismaCreditRepository");
const { createInMemoryJobRepository } = require("./jobs/jobRepository");
const { createPrismaJobRepository } = require("./jobs/prismaJobRepository");
const { createJobService } = require("./jobs/jobService");
const { createInMemoryStripePaymentRepository } = require("./billing/paymentRepository");
const { createStripePaymentRepository } = require("./billing/stripePaymentRepository");
const { createStripeWebhookHandler } = require("./billing/stripeWebhook");

const defaultPlans = {
  starter: { id: "starter", name: "Starter", credits: 200, stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || "" },
  pro: { id: "pro", name: "Pro", credits: 1200, stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "" },
  business: { id: "business", name: "Business", credits: 5000, stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID || "" }
};

function createAppContext(options = {}) {
  const prisma = options.prisma || null;
  const plans = options.plans || defaultPlans;

  const creditRepository = options.creditRepository || (
    prisma ? createPrismaCreditRepository({ prisma }) : createInMemoryCreditRepository()
  );
  const jobRepository = options.jobRepository || (
    prisma ? createPrismaJobRepository({ prisma }) : createInMemoryJobRepository()
  );
  const paymentRepository = options.paymentRepository || (
    prisma ? createStripePaymentRepository({ prisma }) : createInMemoryStripePaymentRepository()
  );

  const creditService = options.creditService || createCreditService({ repository: creditRepository });
  const jobService = options.jobService || createJobService({ jobRepository, creditService });
  const stripeWebhookHandler = options.stripeWebhookHandler || createStripeWebhookHandler({
    creditService,
    paymentRepository,
    plans
  });

  return {
    plans,
    repositories: {
      creditRepository,
      jobRepository,
      paymentRepository
    },
    services: {
      creditService,
      jobService,
      stripeWebhookHandler
    }
  };
}

module.exports = {
  createAppContext,
  defaultPlans
};
