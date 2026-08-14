-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SHOP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SHOP_VERIFICATION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'SHOP_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_APPROVED';

-- CreateEnum
CREATE TYPE "ShopVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShopMemberRole" AS ENUM ('OWNER', 'MODERATOR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "verificationStatus" "ShopVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopMember" (
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ShopMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopMember_pkey" PRIMARY KEY ("shopId","userId")
);

-- CreateTable
CREATE TABLE "ShopFollow" (
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopFollow_pkey" PRIMARY KEY ("shopId","userId")
);

-- CreateTable
CREATE TABLE "ShopReview" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "shopId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_ownerUserId_key" ON "Shop"("ownerUserId");

-- CreateIndex
CREATE INDEX "ShopMember_userId_idx" ON "ShopMember"("userId");

-- CreateIndex
CREATE INDEX "ShopFollow_userId_idx" ON "ShopFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopReview_shopId_authorUserId_key" ON "ShopReview"("shopId", "authorUserId");

-- CreateIndex
CREATE INDEX "ShopReview_shopId_idx" ON "ShopReview"("shopId");

-- CreateIndex
CREATE INDEX "Order_shopId_createdAt_idx" ON "Order"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_buyerUserId_idx" ON "Order"("buyerUserId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopMember" ADD CONSTRAINT "ShopMember_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopMember" ADD CONSTRAINT "ShopMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFollow" ADD CONSTRAINT "ShopFollow_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFollow" ADD CONSTRAINT "ShopFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
