-- Real Stripe Subscriptions for KOBA Plus, plus the per-server bio perk.
--
-- stripeCustomerId/stripeSubscriptionId/cancelAtPeriodEnd on
-- PlusSubscription and AuditAction.PLUS_ACTIVATED were already added by
-- 20250815060000_koba_plus_subscriptions (a parallel-session migration
-- merged in after this one was written, with an earlier timestamp) —
-- removed here so this migration is idempotent on a fresh database
-- (confirmed via a shadow-database replay failure: duplicate ADD VALUE/
-- ADD COLUMN/CREATE UNIQUE INDEX are not idempotent in Postgres).
-- firstActivatedAt and the ServerBio table are still unique to this one.

ALTER TABLE "PlusSubscription" ADD COLUMN "firstActivatedAt" TIMESTAMP(3);

CREATE TABLE "ServerBio" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameServerId" TEXT NOT NULL,
  "bio" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServerBio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServerBio_userId_gameServerId_key" ON "ServerBio"("userId", "gameServerId");
CREATE INDEX "ServerBio_gameServerId_idx" ON "ServerBio"("gameServerId");

ALTER TABLE "ServerBio" ADD CONSTRAINT "ServerBio_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerBio" ADD CONSTRAINT "ServerBio_gameServerId_fkey"
  FOREIGN KEY ("gameServerId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
