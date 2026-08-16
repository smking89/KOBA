-- Phase 14F: KOBA Plus per-KOBAID subscriptions and entitlements

ALTER TYPE "AuditAction" ADD VALUE 'PLUS_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLUS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLUS_PAYMENT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PLUS_RECONCILED';
ALTER TYPE "AuditAction" ADD VALUE 'PLUS_GRANT_ISSUED';

ALTER TYPE "PlusSubscriptionState" ADD VALUE 'INCOMPLETE';
ALTER TYPE "PlusSubscriptionState" ADD VALUE 'TRIALING';
ALTER TYPE "PlusSubscriptionState" ADD VALUE 'UNPAID';
ALTER TYPE "PlusSubscriptionState" ADD VALUE 'PAUSED';

ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

ALTER TABLE "ProcessedStripeEvent" ADD COLUMN "eventCreated" INTEGER;

CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "interval" "PlusPlanInterval" NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "displayAmountCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE INDEX "SubscriptionPlan_active_sortOrder_idx" ON "SubscriptionPlan"("active", "sortOrder");

CREATE TABLE "PlanEntitlement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limitValue" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanEntitlement_planId_code_key" ON "PlanEntitlement"("planId", "code");
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "PlusSubscription";

-- Earlier migration created a unique INDEX, not a table CONSTRAINT.
DROP INDEX IF EXISTS "PlusSubscription_userId_key";
ALTER TABLE "PlusSubscription" DROP CONSTRAINT IF EXISTS "PlusSubscription_userId_key";
ALTER TABLE "PlusSubscription" DROP COLUMN "renewsAt";
ALTER TABLE "PlusSubscription" ADD COLUMN "publicRef" TEXT NOT NULL;
ALTER TABLE "PlusSubscription" ADD COLUMN "kobaIdentityId" TEXT NOT NULL;
ALTER TABLE "PlusSubscription" ADD COLUMN "accountType" "KobaAccountType" NOT NULL;
ALTER TABLE "PlusSubscription" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "PlusSubscription" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "checkoutIdempotencyKey" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlusSubscription" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "PlusSubscription" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "PlusSubscription" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "PlusSubscription" ADD COLUMN "endedAt" TIMESTAMP(3);
ALTER TABLE "PlusSubscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "PlusSubscription" ADD COLUMN "lastStripeEventId" TEXT;
ALTER TABLE "PlusSubscription" ADD COLUMN "lastStripeEventCreated" INTEGER;
ALTER TABLE "PlusSubscription" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "PlusSubscription_publicRef_key" ON "PlusSubscription"("publicRef");
CREATE UNIQUE INDEX "PlusSubscription_kobaIdentityId_key" ON "PlusSubscription"("kobaIdentityId");
CREATE UNIQUE INDEX "PlusSubscription_stripeSubscriptionId_key" ON "PlusSubscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "PlusSubscription_stripeCheckoutSessionId_key" ON "PlusSubscription"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "PlusSubscription_checkoutIdempotencyKey_key" ON "PlusSubscription"("checkoutIdempotencyKey");
CREATE INDEX "PlusSubscription_userId_accountType_idx" ON "PlusSubscription"("userId", "accountType");
CREATE INDEX "PlusSubscription_state_idx" ON "PlusSubscription"("state");
CREATE INDEX "PlusSubscription_stripeCustomerId_idx" ON "PlusSubscription"("stripeCustomerId");

ALTER TABLE "PlusSubscription" ADD CONSTRAINT "PlusSubscription_kobaIdentityId_fkey" FOREIGN KEY ("kobaIdentityId") REFERENCES "KobaIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlusSubscription" ADD CONSTRAINT "PlusSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlusEntitlementGrant" (
    "id" TEXT NOT NULL,
    "kobaIdentityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlusEntitlementGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlusEntitlementGrant_kobaIdentityId_code_idx" ON "PlusEntitlementGrant"("kobaIdentityId", "code");
CREATE INDEX "PlusEntitlementGrant_expiresAt_idx" ON "PlusEntitlementGrant"("expiresAt");
ALTER TABLE "PlusEntitlementGrant" ADD CONSTRAINT "PlusEntitlementGrant_kobaIdentityId_fkey" FOREIGN KEY ("kobaIdentityId") REFERENCES "KobaIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
