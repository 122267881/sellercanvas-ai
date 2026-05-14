ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';

ALTER TABLE "generation_jobs"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "creditOperation" TEXT,
  ADD COLUMN IF NOT EXISTS "succeededAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

ALTER TABLE "generation_jobs"
  ALTER COLUMN "projectId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generation_jobs_userId_fkey'
  ) THEN
    ALTER TABLE "generation_jobs"
      ADD CONSTRAINT "generation_jobs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "generation_jobs_userId_status_idx"
  ON "generation_jobs"("userId", "status");
