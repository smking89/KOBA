-- CreateEnum
CREATE TYPE "PlatformBlacklistTargetType" AS ENUM ('USER', 'SHOP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BLACKLIST_ENTRY_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'BLACKLIST_ENTRY_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_BAN_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_BAN_LIFTED';

-- CreateTable
CREATE TABLE "ShopBlacklistEntry" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "hashtags" TEXT[],
    "requestSocialRemoval" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopBlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformBlacklistEntry" (
    "id" TEXT NOT NULL,
    "targetType" "PlatformBlacklistTargetType" NOT NULL,
    "targetUserId" TEXT,
    "targetShopId" TEXT,
    "reason" TEXT NOT NULL,
    "hashtags" TEXT[],
    "requestSocialRemoval" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopBlacklistEntry_targetUserId_idx" ON "ShopBlacklistEntry"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopBlacklistEntry_shopId_targetUserId_key" ON "ShopBlacklistEntry"("shopId", "targetUserId");

-- CreateIndex
CREATE INDEX "PlatformBlacklistEntry_targetType_idx" ON "PlatformBlacklistEntry"("targetType");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBlacklistEntry_targetUserId_key" ON "PlatformBlacklistEntry"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBlacklistEntry_targetShopId_key" ON "PlatformBlacklistEntry"("targetShopId");

-- AddForeignKey
ALTER TABLE "ShopBlacklistEntry" ADD CONSTRAINT "ShopBlacklistEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopBlacklistEntry" ADD CONSTRAINT "ShopBlacklistEntry_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopBlacklistEntry" ADD CONSTRAINT "ShopBlacklistEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlacklistEntry" ADD CONSTRAINT "PlatformBlacklistEntry_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlacklistEntry" ADD CONSTRAINT "PlatformBlacklistEntry_targetShopId_fkey" FOREIGN KEY ("targetShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlacklistEntry" ADD CONSTRAINT "PlatformBlacklistEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

