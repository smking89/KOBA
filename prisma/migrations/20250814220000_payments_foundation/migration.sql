-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CHECKOUT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_PAID';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_FULFILLED';
ALTER TYPE "AuditAction" ADD VALUE 'CONNECT_ONBOARDED';

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('FIXED', 'AUCTION');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Shop" ADD COLUMN "chargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "publicRef" TEXT;
ALTER TABLE "Order" ADD COLUMN "kind" "OrderKind" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Order" ADD COLUMN "applicationFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "sellerPayoutCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "auctionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "refundedAt" TIMESTAMP(3);

-- Backfill unique columns for any existing rows (none expected)
UPDATE "Order" SET "publicRef" = CONCAT('KOBA-ORD-', SUBSTRING(md5(random()::text), 1, 8)) WHERE "publicRef" IS NULL;
UPDATE "Order" SET "idempotencyKey" = CONCAT('legacy-', "id") WHERE "idempotencyKey" IS NULL;
UPDATE "Order" SET "sellerPayoutCents" = "totalCents" WHERE "sellerPayoutCents" = 0;

ALTER TABLE "Order" ALTER COLUMN "publicRef" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_stripeAccountId_key" ON "Shop"("stripeAccountId");
CREATE UNIQUE INDEX "Order_publicRef_key" ON "Order"("publicRef");
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("eventId")
);
