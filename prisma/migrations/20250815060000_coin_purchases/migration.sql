-- CoinPurchase: real-money purchase of a fixed Coin package via Stripe
-- Checkout. Separate from Order (marketplace purchases) — this is KOBA
-- selling its own Coins directly, no shop/escrow/seller payout involved.

CREATE TYPE "CoinPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "CoinPurchase" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "coinAmount" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "CoinPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "ledgerTransactionRef" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoinPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoinPurchase_publicRef_key" ON "CoinPurchase"("publicRef");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinPurchase_stripeCheckoutSessionId_key" ON "CoinPurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinPurchase_idempotencyKey_key" ON "CoinPurchase"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CoinPurchase_userId_createdAt_idx" ON "CoinPurchase"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CoinPurchase_status_idx" ON "CoinPurchase"("status");

ALTER TABLE "CoinPurchase"
  ADD CONSTRAINT "CoinPurchase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
