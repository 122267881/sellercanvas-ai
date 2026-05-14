# SellerCanvas Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production SaaS architecture foundation beside the existing prototype without deleting working legacy code.

**Architecture:** Keep the current root prototype running while adding a new monorepo-style structure under `apps/`, `packages/`, `workers/`, and `prisma/`. The first migration creates clear boundaries for customer app, admin app, API, AI worker, shared domain rules, billing/credits, AI core logic, and PostgreSQL schema.

**Tech Stack:** Node.js 18+, TypeScript-ready package layout, Prisma schema for PostgreSQL, future Redis/BullMQ worker boundary, existing Node prototype preserved as legacy reference.

---

## File Structure

Create:

- `apps/customer/README.md` - customer-facing app scope and migration boundary.
- `apps/admin/README.md` - developer/admin app scope and permission boundary.
- `apps/api/README.md` - backend API scope and first route groups.
- `workers/ai/README.md` - asynchronous AI job worker scope.
- `packages/shared/src/platforms.js` - platform rules shared by customer, API, and worker.
- `packages/shared/src/creditPricing.js` - shared credit cost table.
- `packages/shared/package.json` - shared package metadata.
- `packages/billing/src/creditLedger.js` - credit reserve, consume, refund, and grant helpers.
- `packages/billing/package.json` - billing package metadata.
- `packages/ai-core/src/promptDoctrine.js` - prompt strategy doctrine and output contract.
- `packages/ai-core/package.json` - AI core package metadata.
- `prisma/schema.prisma` - production PostgreSQL data model.
- `legacy/README.md` - legacy preservation and future archival rules.

Modify:

- `package.json` - add architecture validation scripts while keeping `start` and `check`.
- `.env.example` - add production database, Redis, object storage, Stripe webhook, and worker secrets.

Test:

- `npm.cmd run check`
- `npm.cmd run check:architecture`

---

### Task 1: Add Architecture Directories Without Moving Legacy Code

**Files:**

- Create: `apps/customer/README.md`
- Create: `apps/admin/README.md`
- Create: `apps/api/README.md`
- Create: `workers/ai/README.md`
- Create: `legacy/README.md`

- [ ] **Step 1: Create directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "apps/customer","apps/admin","apps/api","workers/ai","legacy" | Out-Null
```

Expected: directories exist and current root files are unchanged.

- [ ] **Step 2: Create customer app boundary doc**

Write `apps/customer/README.md`:

```markdown
# SellerCanvas Customer App

This app is the future customer-facing SaaS product.

It owns:

- customer registration and login
- subscription purchase and billing views
- credit balance display
- product projects
- image upload
- AI analysis workflow
- generated assets
- Listing copy
- export center
- customer history

It must not expose:

- API Key creation
- AI Provider configuration
- admin customer lists
- global usage
- audit logs
- system health details

During migration, the current root `index.html` and `app.js` remain the legacy runnable customer prototype.
```

- [ ] **Step 3: Create admin app boundary doc**

Write `apps/admin/README.md`:

```markdown
# SellerCanvas Admin App

This app is the future developer and operations dashboard.

It owns:

- admin authentication
- customer management
- subscription and payment records
- invoice records
- credit accounts and credit ledger
- AI job monitoring
- Provider configuration
- API Key management
- usage analytics
- audit logs
- CSV exports

Customer accounts must never access this app.

During migration, the current root `admin.html` and `admin.js` remain the legacy runnable admin prototype.
```

- [ ] **Step 4: Create API app boundary doc**

Write `apps/api/README.md`:

```markdown
# SellerCanvas API

This app is the future production backend API.

It owns:

- auth and sessions
- OAuth callbacks
- project CRUD
- upload signatures
- AI job creation
- AI job status
- credit reserve, consume, and refund
- Stripe checkout
- Stripe webhook processing
- export creation
- admin-only data access

During migration, the current root `server.js` remains the legacy runnable API prototype.
```

- [ ] **Step 5: Create worker boundary doc**

Write `workers/ai/README.md`:

```markdown
# SellerCanvas AI Worker

This worker will execute long-running AI and export jobs outside request-response APIs.

It owns:

- image analysis jobs
- prompt generation jobs
- image generation jobs
- quality review jobs
- listing copy jobs
- export packaging jobs
- retry and failure refund coordination

The customer app creates jobs through the API. The worker updates job status and writes outputs.
```

- [ ] **Step 6: Create legacy policy doc**

Write `legacy/README.md`:

```markdown
# Legacy Prototype Policy

The current root-level prototype remains runnable during migration.

Legacy root files include:

- `index.html`
- `admin.html`
- `app.js`
- `admin.js`
- `server.js`
- `styles.css`
- `data/db.json`
- `exports/`

Do not delete or move them until the new architecture passes the MVP acceptance checklist in `docs/superpowers/specs/2026-05-13-sellercanvas-saas-refactor-design.md`.

The legacy code is a behavior reference, not the destination architecture.
```

- [ ] **Step 7: Verify legacy still starts**

Run:

```powershell
npm.cmd run check
```

Expected: existing syntax checks pass.

---

### Task 2: Add Shared Platform and Credit Rules

**Files:**

- Create: `packages/shared/package.json`
- Create: `packages/shared/src/platforms.js`
- Create: `packages/shared/src/creditPricing.js`

- [ ] **Step 1: Create shared package directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "packages/shared/src" | Out-Null
```

Expected: `packages/shared/src` exists.

- [ ] **Step 2: Add package metadata**

Write `packages/shared/package.json`:

```json
{
  "name": "@sellercanvas/shared",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "main": "src/platforms.js"
}
```

- [ ] **Step 3: Add platform rules**

Write `packages/shared/src/platforms.js`:

```js
const platforms = [
  {
    id: "amazon",
    name: "Amazon",
    heroRatio: "1:1",
    imageSize: "2000x2000",
    mainImageRules: ["white background", "product fills 85% of frame", "no badges on main image"],
    secondaryImageRules: ["lifestyle context allowed", "benefit callouts allowed", "dimension image allowed"],
    textSafeArea: "secondary images only"
  },
  {
    id: "temu",
    name: "Temu",
    heroRatio: "1:1",
    imageSize: "2000x2000",
    mainImageRules: ["clean product focus", "high contrast", "clear value proposition"],
    secondaryImageRules: ["scenario image", "feature image", "bundle or scale image"],
    textSafeArea: "avoid clutter near product center"
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    heroRatio: "4:5",
    imageSize: "1440x1800",
    mainImageRules: ["mobile-first composition", "fast visual hook", "human or use-case context preferred"],
    secondaryImageRules: ["ugc-style scene", "benefit callout", "before-after if truthful"],
    textSafeArea: "top and bottom safe zones"
  },
  {
    id: "etsy",
    name: "Etsy",
    heroRatio: "4:3",
    imageSize: "2000x1500",
    mainImageRules: ["crafted feel", "natural light", "clear handmade or premium cue"],
    secondaryImageRules: ["detail texture", "scale context", "giftable scene"],
    textSafeArea: "minimal text preferred"
  }
];

function getPlatform(id) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}

module.exports = { platforms, getPlatform };
```

- [ ] **Step 4: Add credit pricing rules**

Write `packages/shared/src/creditPricing.js`:

```js
const creditPricing = {
  image_analysis: 5,
  prompt_generation: 3,
  listing_copy_generation: 3,
  image_generation_standard: 15,
  image_generation_hd: 25,
  image_generation_bundle_4: 80,
  export_packaging: 2
};

function getCreditCost(operation) {
  const cost = creditPricing[operation];
  if (!Number.isFinite(cost)) throw new Error(`Unknown credit operation: ${operation}`);
  return cost;
}

module.exports = { creditPricing, getCreditCost };
```

- [ ] **Step 5: Verify modules can load**

Run:

```powershell
node -e "const { getPlatform } = require('./packages/shared/src/platforms'); const { getCreditCost } = require('./packages/shared/src/creditPricing'); console.log(getPlatform('amazon').name, getCreditCost('image_generation_bundle_4'))"
```

Expected output includes:

```text
Amazon 80
```

---

### Task 3: Add Billing Credit Ledger Helpers

**Files:**

- Create: `packages/billing/package.json`
- Create: `packages/billing/src/creditLedger.js`

- [ ] **Step 1: Create billing package directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "packages/billing/src" | Out-Null
```

Expected: `packages/billing/src` exists.

- [ ] **Step 2: Add package metadata**

Write `packages/billing/package.json`:

```json
{
  "name": "@sellercanvas/billing",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "main": "src/creditLedger.js"
}
```

- [ ] **Step 3: Add credit ledger helper**

Write `packages/billing/src/creditLedger.js`:

```js
function assertPositiveAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer");
  }
}

function createCreditAccount({ userId, teamId = null, balance = 0, reserved = 0 }) {
  return {
    userId,
    teamId,
    balance,
    reserved,
    available: balance - reserved
  };
}

function grantCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  const before = account.balance;
  account.balance += amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("grant", amount, before, account.balance, meta);
}

function reserveCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  if (account.balance - account.reserved < amount) {
    throw new Error("Insufficient credits");
  }
  const before = account.balance - account.reserved;
  account.reserved += amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("reserve", amount, before, account.available, meta);
}

function consumeReservedCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  if (account.reserved < amount) {
    throw new Error("Insufficient reserved credits");
  }
  const before = account.balance;
  account.reserved -= amount;
  account.balance -= amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("consume", amount, before, account.balance, meta);
}

function refundReservedCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  if (account.reserved < amount) {
    throw new Error("Insufficient reserved credits");
  }
  const before = account.balance - account.reserved;
  account.reserved -= amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("refund", amount, before, account.available, meta);
}

function ledgerEntry(type, amount, balanceBefore, balanceAfter, meta) {
  return {
    type,
    amount,
    balanceBefore,
    balanceAfter,
    meta,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  createCreditAccount,
  grantCredits,
  reserveCredits,
  consumeReservedCredits,
  refundReservedCredits
};
```

- [ ] **Step 4: Verify credit reserve and consume**

Run:

```powershell
node -e "const c=require('./packages/billing/src/creditLedger'); const a=c.createCreditAccount({userId:'u1',balance:100}); c.reserveCredits(a,80,{jobId:'job1'}); c.consumeReservedCredits(a,80,{jobId:'job1'}); console.log(JSON.stringify(a))"
```

Expected output includes:

```json
{"userId":"u1","teamId":null,"balance":20,"reserved":0,"available":20}
```

---

### Task 4: Add AI Core Prompt Doctrine Contract

**Files:**

- Create: `packages/ai-core/package.json`
- Create: `packages/ai-core/src/promptDoctrine.js`

- [ ] **Step 1: Create AI core package directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "packages/ai-core/src" | Out-Null
```

Expected: `packages/ai-core/src` exists.

- [ ] **Step 2: Add package metadata**

Write `packages/ai-core/package.json`:

```json
{
  "name": "@sellercanvas/ai-core",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "main": "src/promptDoctrine.js"
}
```

- [ ] **Step 3: Add prompt doctrine**

Write `packages/ai-core/src/promptDoctrine.js`:

```js
const promptDoctrine = {
  role: [
    "global visual marketing director",
    "cross-border ecommerce operator",
    "brand strategist"
  ],
  principles: [
    "direct a conversion-focused visual scene instead of merely describing an image",
    "apply AIDA and FAB to every visual and copy decision",
    "simulate buyer first glance, trust detail, desire trigger, and purchase action",
    "optimize for buyer conversion rather than designer self-expression"
  ],
  requiredPromptLayers: [
    "product role",
    "brand tone",
    "scene narrative",
    "visual impact",
    "platform adaptation",
    "emotional anchor",
    "negative prompt"
  ],
  assetTypes: ["main", "lifestyle", "dimension", "marketing"]
};

function createPromptContract(project, platform) {
  return {
    projectId: project.id,
    platform: platform.id,
    doctrine: promptDoctrine,
    requiredOutputs: promptDoctrine.assetTypes.map((type) => ({
      type,
      prompt: "",
      negativePrompt: "",
      complianceNotes: [],
      safeArea: platform.textSafeArea
    }))
  };
}

module.exports = { promptDoctrine, createPromptContract };
```

- [ ] **Step 4: Verify prompt contract can load**

Run:

```powershell
node -e "const { getPlatform } = require('./packages/shared/src/platforms'); const { createPromptContract } = require('./packages/ai-core/src/promptDoctrine'); const c=createPromptContract({id:'p1'}, getPlatform('etsy')); console.log(c.requiredOutputs.length, c.requiredOutputs[0].safeArea)"
```

Expected output includes:

```text
4 minimal text preferred
```

---

### Task 5: Add Prisma Production Data Model

**Files:**

- Create: `prisma/schema.prisma`

- [ ] **Step 1: Create Prisma directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "prisma" | Out-Null
```

Expected: `prisma` exists.

- [ ] **Step 2: Add production schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id             String          @id @default(cuid())
  email          String          @unique
  name           String
  role           UserRole        @default(CUSTOMER)
  passwordHash   String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  sessions       Session[]
  oauthAccounts  OAuthAccount[]
  memberships    TeamMember[]
  projects       Project[]
  subscriptions  Subscription[]
  payments       Payment[]
  invoices       Invoice[]
  creditAccounts CreditAccount[]
  apiKeys        ApiKey[]
  apiUsage       ApiUsage[]
  auditLogs      AdminAuditLog[] @relation("AdminActor")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model OAuthAccount {
  id             String   @id @default(cuid())
  userId         String
  provider       String
  providerUserId String
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
}

model Team {
  id             String          @id @default(cuid())
  name           String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  members        TeamMember[]
  projects       Project[]
  creditAccounts CreditAccount[]
}

model TeamMember {
  id        String     @id @default(cuid())
  teamId    String
  userId    String
  role      TeamRole   @default(MEMBER)
  createdAt DateTime   @default(now())
  team      Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
}

model Subscription {
  id                   String             @id @default(cuid())
  userId               String
  plan                 String
  status               SubscriptionStatus
  provider             String             @default("stripe")
  stripeCustomerId     String?
  stripeSubscriptionId String?
  currentPeriodEnd     DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Payment {
  id              String        @id @default(cuid())
  userId          String
  provider        String        @default("stripe")
  providerEventId String?
  providerRef     String?
  plan            String?
  amount          Int
  currency        String        @default("USD")
  status          PaymentStatus
  createdAt       DateTime      @default(now())
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  invoices        Invoice[]
}

model Invoice {
  id        String        @id @default(cuid())
  userId    String
  paymentId String?
  plan      String?
  amount    Int
  currency  String        @default("USD")
  status    InvoiceStatus
  pdfUrl    String?
  createdAt DateTime      @default(now())
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  payment   Payment?      @relation(fields: [paymentId], references: [id], onDelete: SetNull)
}

model CreditAccount {
  id        String        @id @default(cuid())
  userId    String?
  teamId    String?
  balance   Int           @default(0)
  reserved  Int           @default(0)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  user      User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  team      Team?         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  ledger    CreditLedger[]
}

model CreditLedger {
  id              String           @id @default(cuid())
  creditAccountId String
  type            CreditLedgerType
  amount          Int
  balanceBefore   Int
  balanceAfter    Int
  jobId           String?
  paymentId       String?
  meta            Json?
  createdAt       DateTime         @default(now())
  account         CreditAccount    @relation(fields: [creditAccountId], references: [id], onDelete: Cascade)
}

model Project {
  id          String           @id @default(cuid())
  userId      String
  teamId      String?
  name        String
  platform    String
  status      ProjectStatus    @default(DRAFT)
  product     Json
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  team        Team?            @relation(fields: [teamId], references: [id], onDelete: SetNull)
  images      ProjectImage[]
  analyses    ImageAnalysis[]
  prompts     PromptVersion[]
  jobs        GenerationJob[]
  assets      GeneratedAsset[]
  listingCopy ListingCopy?
  exports     ExportPack[]
}

model ProjectImage {
  id        String   @id @default(cuid())
  projectId String
  kind      String
  storageKey String
  url       String
  mimeType  String
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model ImageAnalysis {
  id        String   @id @default(cuid())
  projectId String
  imageId   String?
  provider  String
  model     String
  facts     Json
  strategy  Json
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model PromptVersion {
  id        String   @id @default(cuid())
  projectId String
  version   Int
  platform  String
  prompts   Json
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, version])
}

model GenerationJob {
  id              String          @id @default(cuid())
  projectId       String
  type            GenerationType
  status          JobStatus       @default(QUEUED)
  provider        String?
  model           String?
  creditAmount    Int
  creditLedgerId  String?
  input           Json
  output          Json?
  error           String?
  retryCount      Int             @default(0)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model GeneratedAsset {
  id        String   @id @default(cuid())
  projectId String
  jobId     String?
  type      String
  label     String
  storageKey String
  url       String
  provider  String
  prompt    String
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model ListingCopy {
  id          String   @id @default(cuid())
  projectId   String   @unique
  title       String
  bullets     Json
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model ExportPack {
  id        String   @id @default(cuid())
  projectId String
  storageKey String
  url       String
  assetCount Int
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model ProviderConfig {
  id        String   @id @default(cuid())
  provider  String
  mode      String
  baseUrl   String
  textModel String
  imageModel String
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  name      String
  prefix    String
  hash      String   @unique
  revokedAt DateTime?
  createdAt DateTime @default(now())
  lastUsedAt DateTime?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ApiUsage {
  id        String   @id @default(cuid())
  userId    String
  apiKeyId  String?
  endpoint  String
  units     Int
  status    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AdminAuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  type      String
  message   String
  meta      Json?
  createdAt DateTime @default(now())
  actor     User?    @relation("AdminActor", fields: [actorId], references: [id], onDelete: SetNull)
}

enum UserRole {
  CUSTOMER
  ADMIN
}

enum TeamRole {
  OWNER
  MEMBER
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  INCOMPLETE
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum InvoiceStatus {
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}

enum CreditLedgerType {
  GRANT
  RESERVE
  CONSUME
  REFUND
  EXPIRE
  ADMIN_ADJUST
}

enum ProjectStatus {
  DRAFT
  ANALYZED
  GENERATED
  EXPORTED
  ARCHIVED
}

enum GenerationType {
  IMAGE_ANALYSIS
  PROMPT_GENERATION
  IMAGE_GENERATION
  IMAGE_QUALITY_REVIEW
  LISTING_COPY_GENERATION
  EXPORT_PACKAGING
}

enum JobStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
  REFUNDED
  CANCELED
}
```

- [ ] **Step 3: Verify Prisma schema text exists**

Run:

```powershell
rg -n "model CreditAccount|model GenerationJob|enum JobStatus|model ProviderConfig" prisma/schema.prisma
```

Expected: all four patterns are found.

---

### Task 6: Add Architecture Validation Script

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add `check:architecture` script**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "start": "node server.js",
    "prod": "node server.js",
    "check": "node --check server.js && node --check app.js && node --check admin.js",
    "check:architecture": "node -e \"const fs=require('fs'); const required=['apps/customer/README.md','apps/admin/README.md','apps/api/README.md','workers/ai/README.md','packages/shared/src/platforms.js','packages/shared/src/creditPricing.js','packages/billing/src/creditLedger.js','packages/ai-core/src/promptDoctrine.js','prisma/schema.prisma','legacy/README.md']; const missing=required.filter(p=>!fs.existsSync(p)); if(missing.length){console.error('Missing architecture files:', missing.join(', ')); process.exit(1)} console.log('Architecture files OK')\""
  }
}
```

- [ ] **Step 2: Run architecture validation**

Run:

```powershell
npm.cmd run check:architecture
```

Expected output:

```text
Architecture files OK
```

- [ ] **Step 3: Run legacy validation**

Run:

```powershell
npm.cmd run check
```

Expected: syntax checks pass.

---

### Task 7: Extend Environment Example for Production Architecture

**Files:**

- Modify: `.env.example`

- [ ] **Step 1: Add required production variables**

Append to `.env.example`:

```text

# Production database
DATABASE_URL=postgresql://sellercanvas:sellercanvas@postgres:5432/sellercanvas

# Redis queue
REDIS_URL=redis://redis:6379

# Object storage
STORAGE_PROVIDER=r2
STORAGE_BUCKET=sellercanvas-assets
STORAGE_PUBLIC_BASE_URL=https://assets.your-domain.com
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# Stripe webhooks
STRIPE_WEBHOOK_SECRET=

# Internal worker authentication
WORKER_INTERNAL_SECRET=change-this-worker-secret
```

- [ ] **Step 2: Verify variables are present**

Run:

```powershell
rg -n "DATABASE_URL|REDIS_URL|STORAGE_PROVIDER|STRIPE_WEBHOOK_SECRET|WORKER_INTERNAL_SECRET" .env.example
```

Expected: every variable is found.

---

### Task 8: Final Migration Foundation Verification

**Files:**

- Test only.

- [ ] **Step 1: Run all syntax and architecture checks**

Run:

```powershell
npm.cmd run check
npm.cmd run check:architecture
```

Expected:

```text
node --check server.js && node --check app.js && node --check admin.js
Architecture files OK
```

- [ ] **Step 2: Verify shared package behavior**

Run:

```powershell
node -e "const { platforms } = require('./packages/shared/src/platforms'); const { creditPricing } = require('./packages/shared/src/creditPricing'); console.log(platforms.length, creditPricing.image_generation_bundle_4)"
```

Expected output:

```text
4 80
```

- [ ] **Step 3: Verify billing helper behavior**

Run:

```powershell
node -e "const c=require('./packages/billing/src/creditLedger'); const a=c.createCreditAccount({userId:'u1',balance:20}); try{c.reserveCredits(a,80)}catch(e){console.log(e.message)}"
```

Expected output:

```text
Insufficient credits
```

- [ ] **Step 4: Verify prompt doctrine behavior**

Run:

```powershell
node -e "const { promptDoctrine } = require('./packages/ai-core/src/promptDoctrine'); console.log(promptDoctrine.requiredPromptLayers.includes('negative prompt'))"
```

Expected output:

```text
true
```

---

## Self-Review

- Spec coverage: This plan implements the first migration slice from the SaaS refactor spec: preserve legacy, introduce production architecture boundaries, define shared platform rules, define credit pricing, define credit ledger helpers, define AI prompt doctrine, and add the PostgreSQL schema.
- Placeholder scan: No placeholder implementation steps are left. Environment variables with blank values are intentional because secrets must not be committed.
- Type consistency: Credit operation names in `creditPricing.js` match the AI job categories in the Prisma `GenerationType` enum conceptually. Ledger types in helper functions map to Prisma `CreditLedgerType` enum values using lowercase helper output and uppercase database enum values, which will need a mapping layer in the API implementation plan.
- Scope check: This plan does not implement runtime API routes, Stripe webhook handlers, Prisma client code, or queue workers. Those belong in the next implementation plan after this foundation is created and verified.
