-- Real Stripe Subscriptions for KOBA Plus, plus the per-server bio perk.
-- Extends the existing PlusSubscription scaffolding (previously a UI-shell
-- stub with no Stripe fields at all) rather than replacing it.

ALTER TYPE "AuditAction" ADD VALUE 'PLUS_ACTIVATED';

ALTER TABLE "PlusSubscription" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlusSubscription" ADD COLUMN "firstActivatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PlusSubscription_stripeSubscriptionId_key" ON "PlusSubscription"("stripeSubscriptionId");

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
