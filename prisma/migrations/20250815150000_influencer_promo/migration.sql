-- Phase 14I: influencer promo, referral codes, and earnings

-- PromoPayoutType was already created by 20250815040000_add_cosmetics_and_shop_promo
-- (a parallel-session migration, earlier timestamp) as ('PERCENT', 'FIXED').
-- Renamed to the ('PERCENT_BPS', 'FIXED_CENTS') values this migration
-- actually needs instead of re-creating the type under the same name (which
-- fails outright on a fresh database — confirmed via a shadow-database
-- replay failure: a type name can only be created once).
ALTER TYPE "PromoPayoutType" RENAME VALUE 'PERCENT' TO 'PERCENT_BPS';
ALTER TYPE "PromoPayoutType" RENAME VALUE 'FIXED' TO 'FIXED_CENTS';
CREATE TYPE "InfluencerEarningStatus" AS ENUM ('ACCRUED', 'PAYABLE', 'PAID', 'VOID', 'HELD');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFERRAL_CODE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFERRAL_CODE_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFERRAL_ATTRIBUTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_EARNING_ACCRUED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_EARNING_PAID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_EARNING_VOIDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SHOP_PROMO_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_PAYOUT_ONBOARDED';

-- ShopPromoConfig was already created by 20250815040000_add_cosmetics_and_shop_promo
-- (a parallel-session migration merged in after this one was written, with an
-- earlier timestamp), but with payoutType/payoutValue defaulting to the old
-- 'PERCENT'/0 scheme. Reconciled here to the PromoPayoutType enum + BPS
-- defaults this migration actually introduces, instead of re-creating the
-- table (which is not idempotent on a fresh database — confirmed via a
-- shadow-database replay failure).
ALTER TABLE "ShopPromoConfig" ALTER COLUMN "payoutType" TYPE "PromoPayoutType" USING 'PERCENT_BPS'::"PromoPayoutType";
ALTER TABLE "ShopPromoConfig" ALTER COLUMN "payoutType" SET DEFAULT 'PERCENT_BPS';
ALTER TABLE "ShopPromoConfig" ALTER COLUMN "payoutValue" SET DEFAULT 1000;

CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "influencerUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "influencerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfluencerEarning" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "influencerUserId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InfluencerEarningStatus" NOT NULL DEFAULT 'ACCRUED',
    "stripeTransferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "InfluencerEarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfluencerPayoutAccount" (
    "userId" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerPayoutAccount_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "Order" ADD COLUMN "referralCodeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "influencerShareCents" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ReferralCode_publicRef_key" ON "ReferralCode"("publicRef");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE UNIQUE INDEX "ReferralCode_influencerUserId_productId_key" ON "ReferralCode"("influencerUserId", "productId");
CREATE INDEX "ReferralCode_shopId_active_idx" ON "ReferralCode"("shopId", "active");
CREATE INDEX "ReferralCode_productId_active_idx" ON "ReferralCode"("productId", "active");

CREATE UNIQUE INDEX "ReferralAttribution_orderId_key" ON "ReferralAttribution"("orderId");
CREATE INDEX "ReferralAttribution_referralCodeId_idx" ON "ReferralAttribution"("referralCodeId");
CREATE INDEX "ReferralAttribution_influencerUserId_idx" ON "ReferralAttribution"("influencerUserId");

CREATE UNIQUE INDEX "InfluencerEarning_publicRef_key" ON "InfluencerEarning"("publicRef");
CREATE UNIQUE INDEX "InfluencerEarning_orderId_key" ON "InfluencerEarning"("orderId");
CREATE UNIQUE INDEX "InfluencerEarning_stripeTransferId_key" ON "InfluencerEarning"("stripeTransferId");
CREATE INDEX "InfluencerEarning_influencerUserId_createdAt_idx" ON "InfluencerEarning"("influencerUserId", "createdAt");
CREATE INDEX "InfluencerEarning_status_idx" ON "InfluencerEarning"("status");

CREATE UNIQUE INDEX "InfluencerPayoutAccount_stripeAccountId_key" ON "InfluencerPayoutAccount"("stripeAccountId");
CREATE INDEX "Order_referralCodeId_idx" ON "Order"("referralCodeId");

-- ShopPromoConfig_shopId_fkey was already added by
-- 20250815040000_add_cosmetics_and_shop_promo (see note above) — not
-- idempotent to re-add on a fresh database.
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_influencerUserId_fkey" FOREIGN KEY ("influencerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfluencerEarning" ADD CONSTRAINT "InfluencerEarning_influencerUserId_fkey" FOREIGN KEY ("influencerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfluencerEarning" ADD CONSTRAINT "InfluencerEarning_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfluencerEarning" ADD CONSTRAINT "InfluencerEarning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfluencerPayoutAccount" ADD CONSTRAINT "InfluencerPayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
