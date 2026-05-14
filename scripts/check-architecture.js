"use strict";

const fs = require("fs");

const requiredFiles = [
  "index.html",
  "admin.html",
  "app.js",
  "admin.js",
  "server.js",
  "styles.css",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "apps/api/README.md",
  "workers/ai/README.md",
  "packages/shared/src/platforms.js",
  "packages/shared/src/creditPricing.js",
  "packages/billing/src/creditLedger.js",
  "packages/ai-core/src/promptDoctrine.js",
  "apps/api/src/billing/prismaCreditRepository.js",
  "apps/api/src/billing/stripePaymentRepository.js",
  "apps/api/src/jobs/prismaJobRepository.js",
  "prisma/schema.prisma",
  "prisma/migrations/000001_billing_constraints/migration.sql",
  "prisma/migrations/000002_stripe_events_and_grants/migration.sql",
  "prisma/migrations/000003_runtime_prisma_persistence/migration.sql",
  "scripts/check-commercial-flow.js",
  "scripts/check-api.js",
  "scripts/check-api-routes.js",
  "scripts/check-api-v2-http.js",
  "scripts/check-prisma-adapters.js",
  "scripts/check-prisma-runtime.js"
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error("Missing architecture files:", missing.join(", "));
  process.exit(1);
}

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const billingMigration = fs.readFileSync("prisma/migrations/000001_billing_constraints/migration.sql", "utf8");
const stripeMigration = fs.readFileSync("prisma/migrations/000002_stripe_events_and_grants/migration.sql", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");

for (const token of [
  "model StripeEvent",
  "model CreditGrant",
  "providerEventId String   @unique",
  "grantKey  String   @unique",
  "@@map(\"stripe_events\")",
  "@@map(\"credit_grants\")",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "payment         Payment?",
  "apiKey    ApiKey?",
  "image     ProjectImage?",
  "job             GenerationJob?"
]) {
  assertIncludes(schema, token, "schema");
}

for (const token of [
  "credit_accounts_balance_non_negative",
  "credit_accounts_reserved_non_negative",
  "credit_accounts_reserved_not_above_balance"
]) {
  assertIncludes(billingMigration, token, "billing migration");
}

for (const token of [
  "CREATE TABLE \"stripe_events\"",
  "CREATE TABLE \"credit_grants\"",
  "stripe_events_providerEventId_key",
  "credit_grants_grantKey_key"
]) {
  assertIncludes(stripeMigration, token, "stripe migration");
}

for (const token of [
  "客户使用网站：`http://localhost:4173`",
  "开发者管理后台：`http://localhost:4173/admin`",
  "npm.cmd run check:commercial",
  "http://localhost:4173/admin#/providers",
  "http://localhost:4173/admin#/api"
]) {
  assertIncludes(readme, token, "README");
}

for (const token of [
  ".env",
  "data/",
  "exports/",
  "data/provider-secrets.json"
]) {
  assertIncludes(gitignore, token, ".gitignore");
}

const { getPlatform } = require("../packages/shared/src/platforms");
let platformRejected = false;
try {
  getPlatform("invalid-platform");
} catch (error) {
  platformRejected = /Unknown platform/.test(error.message);
}
if (!platformRejected) {
  console.error("getPlatform must reject unknown platform IDs");
  process.exit(1);
}

const credits = require("../packages/billing/src/creditLedger");
const account = credits.createCreditAccount({ userId: "user_arch", balance: 10 });
const reserveEntry = credits.reserveCredits(account, 5);
if (reserveEntry.type !== "RESERVE" || reserveEntry.balanceBefore !== 10 || reserveEntry.reservedAfter !== 5) {
  console.error("Credit ledger semantics check failed");
  process.exit(1);
}

console.log("Architecture files OK");

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    console.error(`${label} marker missing: ${token}`);
    process.exit(1);
  }
}
