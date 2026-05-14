"use strict";

function createRuntimePrismaClient(env = process.env) {
  const persistence = String(env.PERSISTENCE || env.SELLERCANVAS_PERSISTENCE || "").toLowerCase();
  if (persistence !== "prisma") {
    return null;
  }
  if (!env.DATABASE_URL) {
    console.warn("PERSISTENCE=prisma is set, but DATABASE_URL is missing. Falling back to in-memory repositories.");
    return null;
  }

  try {
    const { PrismaClient } = require("@prisma/client");
    const client = new PrismaClient({
      log: env.PRISMA_LOG === "true" ? ["warn", "error"] : ["error"]
    });
    return {
      client,
      mode: "prisma"
    };
  } catch (error) {
    console.warn(`Prisma Client is unavailable. Falling back to in-memory repositories: ${error.message}`);
    return null;
  }
}

module.exports = {
  createRuntimePrismaClient
};
