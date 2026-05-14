CREATE TABLE "stripe_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "action" TEXT,
  "userId" TEXT,
  "credits" INTEGER,
  "grantKey" TEXT,
  "payload" JSONB,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_grants" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "grantKey" TEXT NOT NULL,
  "eventId" TEXT,
  "eventType" TEXT,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "credit_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_events_providerEventId_key" ON "stripe_events"("providerEventId");
CREATE INDEX "stripe_events_userId_createdAt_idx" ON "stripe_events"("userId", "createdAt");
CREATE INDEX "stripe_events_grantKey_idx" ON "stripe_events"("grantKey");

CREATE UNIQUE INDEX "credit_grants_grantKey_key" ON "credit_grants"("grantKey");
CREATE INDEX "credit_grants_userId_status_idx" ON "credit_grants"("userId", "status");
CREATE INDEX "credit_grants_eventId_idx" ON "credit_grants"("eventId");
