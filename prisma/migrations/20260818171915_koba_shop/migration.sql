-- CreateEnum
CREATE TYPE "KobaShopApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'KOBA_SHOP_APPLICATION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'KOBA_SHOP_APPLICATION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'KOBA_SHOP_APPLICATION_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'COSMETIC_PURCHASED';
ALTER TYPE "AuditAction" ADD VALUE 'COSMETIC_EQUIPPED';
ALTER TYPE "AuditAction" ADD VALUE 'COSMETIC_UNEQUIPPED';

-- CreateTable
CREATE TABLE "KobaShopApplication" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "KobaShopApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KobaShopApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticOrder" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "unitPriceCents" INTEGER NOT NULL,
    "applicationFeeCents" INTEGER NOT NULL,
    "sellerPayoutCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticOwnership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticEquip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subType" "CosmeticSubType" NOT NULL,
    "cosmeticOwnershipId" TEXT NOT NULL,
    "equippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticEquip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCosmeticEquip" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "cosmeticOwnershipId" TEXT NOT NULL,
    "equippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopCosmeticEquip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KobaShopApplication_shopId_key" ON "KobaShopApplication"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticOrder_publicRef_key" ON "CosmeticOrder"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticOrder_idempotencyKey_key" ON "CosmeticOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CosmeticOrder_shopId_idx" ON "CosmeticOrder"("shopId");

-- CreateIndex
CREATE INDEX "CosmeticOrder_buyerUserId_idx" ON "CosmeticOrder"("buyerUserId");

-- CreateIndex
CREATE INDEX "CosmeticOrder_cosmeticId_idx" ON "CosmeticOrder"("cosmeticId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticOwnership_orderId_key" ON "CosmeticOwnership"("orderId");

-- CreateIndex
CREATE INDEX "CosmeticOwnership_userId_idx" ON "CosmeticOwnership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticOwnership_userId_cosmeticId_key" ON "CosmeticOwnership"("userId", "cosmeticId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticEquip_cosmeticOwnershipId_key" ON "CosmeticEquip"("cosmeticOwnershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticEquip_userId_subType_key" ON "CosmeticEquip"("userId", "subType");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCosmeticEquip_shopId_key" ON "ShopCosmeticEquip"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCosmeticEquip_cosmeticOwnershipId_key" ON "ShopCosmeticEquip"("cosmeticOwnershipId");

-- AddForeignKey
ALTER TABLE "KobaShopApplication" ADD CONSTRAINT "KobaShopApplication_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KobaShopApplication" ADD CONSTRAINT "KobaShopApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOrder" ADD CONSTRAINT "CosmeticOrder_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOrder" ADD CONSTRAINT "CosmeticOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOrder" ADD CONSTRAINT "CosmeticOrder_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOwnership" ADD CONSTRAINT "CosmeticOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOwnership" ADD CONSTRAINT "CosmeticOwnership_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOwnership" ADD CONSTRAINT "CosmeticOwnership_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CosmeticOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticEquip" ADD CONSTRAINT "CosmeticEquip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticEquip" ADD CONSTRAINT "CosmeticEquip_cosmeticOwnershipId_fkey" FOREIGN KEY ("cosmeticOwnershipId") REFERENCES "CosmeticOwnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCosmeticEquip" ADD CONSTRAINT "ShopCosmeticEquip_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCosmeticEquip" ADD CONSTRAINT "ShopCosmeticEquip_cosmeticOwnershipId_fkey" FOREIGN KEY ("cosmeticOwnershipId") REFERENCES "CosmeticOwnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

