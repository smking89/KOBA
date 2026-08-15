-- Boost economy: a purchasable, giftable, wallet-held visibility token
-- (10 min, 3x exposure) applicable to a product, shop, or group.

ALTER TYPE "AuditAction" ADD VALUE 'BOOST_PURCHASED';
ALTER TYPE "AuditAction" ADD VALUE 'BOOST_GIFTED';
ALTER TYPE "AuditAction" ADD VALUE 'BOOST_APPLIED';

CREATE TYPE "BoostTargetKind" AS ENUM ('PRODUCT', 'SHOP', 'GROUP');
CREATE TYPE "BoostStatus" AS ENUM ('UNUSED', 'APPLIED', 'EXPIRED');

CREATE TABLE "Boost" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "status" "BoostStatus" NOT NULL DEFAULT 'UNUSED',
  "purchaseCoinCost" INTEGER NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "giftedFromUserId" TEXT,
  "giftedAt" TIMESTAMP(3),
  "targetType" "BoostTargetKind",
  "targetId" TEXT,
  "appliedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,

  CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Boost_idempotencyKey_key" ON "Boost"("idempotencyKey");
CREATE INDEX "Boost_ownerUserId_idx" ON "Boost"("ownerUserId");
CREATE INDEX "Boost_targetType_targetId_idx" ON "Boost"("targetType", "targetId");

ALTER TABLE "Boost" ADD CONSTRAINT "Boost_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_giftedFromUserId_fkey"
  FOREIGN KEY ("giftedFromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
