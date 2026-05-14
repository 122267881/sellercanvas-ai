# SellerCanvas Prisma Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production persistence adapters for the credit, job, and Stripe webhook services using Prisma-style repository boundaries.

**Architecture:** Keep the tested in-memory repositories for smoke tests and local service validation, then add Prisma adapter modules that accept an injected Prisma client. This avoids requiring a live database in this slice while locking down the persistence contract for the next HTTP/API integration slice.

**Tech Stack:** Node.js 18+, CommonJS modules, Prisma schema, fake Prisma clients for verification, no destructive legacy changes.

---

## File Structure

Create:

- `apps/api/src/billing/prismaCreditRepository.js` - Prisma-backed credit repository adapter.
- `apps/api/src/billing/stripePaymentRepository.js` - Prisma-backed Stripe event and credit grant claim repository.
- `apps/api/src/jobs/prismaJobRepository.js` - Prisma-backed generation job repository adapter.
- `scripts/check-prisma-adapters.js` - fake Prisma verification for all adapters.

Modify:

- `prisma/schema.prisma` - add `StripeEvent` and `CreditGrant` models.
- `package.json` - add `check:prisma-adapters` and include it in `check`.

Verification:

- `npm.cmd run check:api`
- `npm.cmd run check:prisma-adapters`
- `npm.cmd run check`
- `npm.cmd run check:architecture`

---

## Tasks

- [ ] Add `StripeEvent` and `CreditGrant` schema models with unique `providerEventId` and `grantKey`.
- [ ] Add Prisma credit repository adapter compatible with `createCreditService`.
- [ ] Add Prisma job repository adapter compatible with `createJobService`.
- [ ] Add Stripe payment repository adapter compatible with `createStripeWebhookHandler`.
- [ ] Add fake Prisma tests covering credit persistence, job persistence, event idempotency, grant claim/finalize/release.
- [ ] Add check scripts and run all verification commands.

---

## Self-Review

This slice does not expose HTTP routes and does not require a live PostgreSQL server. The goal is to make the service contracts production-ready before routing customer actions into them.
