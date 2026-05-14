"use strict";

const { createAppContext, createRuntimePrismaClient } = require("../apps/api/src");

function run() {
  const fallback = createRuntimePrismaClient({ PERSISTENCE: "memory" });
  assert(fallback === null, "Runtime Prisma client should be disabled unless PERSISTENCE=prisma");

  const missingUrl = createRuntimePrismaClient({ PERSISTENCE: "prisma" });
  assert(missingUrl === null, "Runtime Prisma client should fall back when DATABASE_URL is missing");

  const memoryContext = createAppContext();
  assert(memoryContext.persistence.mode === "memory", "App context should default to memory persistence");

  const fakePrisma = {
    creditAccount: {},
    creditLedger: {},
    generationJob: {},
    stripeEvent: {},
    creditGrant: {}
  };
  const prismaContext = createAppContext({ prisma: fakePrisma });
  assert(prismaContext.persistence.mode === "prisma", "App context should report Prisma persistence when a Prisma client is injected");

  console.log("Prisma runtime OK");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run();
