-- CreateEnum
CREATE TYPE "CosmeticSubType" AS ENUM ('AVATAR_DECORATION', 'PROFILE_EFFECT', 'NAMEPLATE');

-- CreateEnum
CREATE TYPE "PromoPayoutType" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "Cosmetic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerShopId" TEXT NOT NULL,
    "subType" "CosmeticSubType" NOT NULL,
    "rarity" "ProductRarity" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPromoConfig" (
    "shopId" TEXT NOT NULL,
    "influencerEligible" BOOLEAN NOT NULL DEFAULT false,
    "payoutType" "PromoPayoutType" NOT NULL DEFAULT 'PERCENT',
    "payoutValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPromoConfig_pkey" PRIMARY KEY ("shopId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cosmetic_slug_key" ON "Cosmetic"("slug");

-- CreateIndex
CREATE INDEX "Cosmetic_ownerShopId_idx" ON "Cosmetic"("ownerShopId");

-- CreateIndex
CREATE INDEX "Cosmetic_moderationStatus_idx" ON "Cosmetic"("moderationStatus");

-- CreateIndex
CREATE INDEX "Cosmetic_subType_idx" ON "Cosmetic"("subType");

-- CreateIndex
CREATE INDEX "Cosmetic_rarity_idx" ON "Cosmetic"("rarity");

-- AddForeignKey
ALTER TABLE "Cosmetic" ADD CONSTRAINT "Cosmetic_ownerShopId_fkey" FOREIGN KEY ("ownerShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoConfig" ADD CONSTRAINT "ShopPromoConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
