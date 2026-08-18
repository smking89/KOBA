-- CreateEnum
CREATE TYPE "ProductSubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('RCON', 'PLUGIN_API');


-- AlterTable
ALTER TABLE "GameServer" ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'RCON';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "expiryKitName" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "subscriptionInterval" "PlusPlanInterval";

-- AlterTable
ALTER TABLE "RconCommandJob" ADD COLUMN     "productSubscriptionId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ServerApiKey" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ServerApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubscription" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "gamertag" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" "ProductSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "applicationFeeCents" INTEGER NOT NULL,
    "sellerPayoutCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerApiKey_serverId_key" ON "ServerApiKey"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubscription_publicRef_key" ON "ProductSubscription"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubscription_stripeSubscriptionId_key" ON "ProductSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "ProductSubscription_buyerUserId_idx" ON "ProductSubscription"("buyerUserId");

-- CreateIndex
CREATE INDEX "ProductSubscription_shopId_status_idx" ON "ProductSubscription"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubscriptionInvoice_stripeInvoiceId_key" ON "ProductSubscriptionInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "ProductSubscriptionInvoice_subscriptionId_idx" ON "ProductSubscriptionInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "RconCommandJob_productSubscriptionId_idx" ON "RconCommandJob"("productSubscriptionId");

-- AddForeignKey
ALTER TABLE "ServerApiKey" ADD CONSTRAINT "ServerApiKey_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RconCommandJob" ADD CONSTRAINT "RconCommandJob_productSubscriptionId_fkey" FOREIGN KEY ("productSubscriptionId") REFERENCES "ProductSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubscription" ADD CONSTRAINT "ProductSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubscription" ADD CONSTRAINT "ProductSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubscription" ADD CONSTRAINT "ProductSubscription_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubscription" ADD CONSTRAINT "ProductSubscription_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubscriptionInvoice" ADD CONSTRAINT "ProductSubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ProductSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

