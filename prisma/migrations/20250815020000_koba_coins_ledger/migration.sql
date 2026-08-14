-- Phase 14B: KOBA Coins double-entry ledger upgrade

-- New enums
CREATE TYPE "LedgerTxStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED');
CREATE TYPE "CoinWalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "CoinReservationStatus" AS ENUM ('PENDING', 'ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "CoinCurrency" AS ENUM ('KOBA_COIN');

-- Expand CoinTxCategory
ALTER TYPE "CoinTxCategory" ADD VALUE 'ISSUANCE';
ALTER TYPE "CoinTxCategory" ADD VALUE 'PURCHASE_CREDIT';
ALTER TYPE "CoinTxCategory" ADD VALUE 'RESERVATION';
ALTER TYPE "CoinTxCategory" ADD VALUE 'RESERVATION_CAPTURE';
ALTER TYPE "CoinTxCategory" ADD VALUE 'RESERVATION_RELEASE';
ALTER TYPE "CoinTxCategory" ADD VALUE 'MARKETPLACE_PURCHASE';
ALTER TYPE "CoinTxCategory" ADD VALUE 'PLATFORM_COMMISSION';
ALTER TYPE "CoinTxCategory" ADD VALUE 'ADMIN_ADJUSTMENT';
ALTER TYPE "CoinTxCategory" ADD VALUE 'REVERSAL';

-- Replace LedgerAccountKind
CREATE TYPE "LedgerAccountKind_new" AS ENUM (
  'USER_PURCHASED',
  'USER_PROMOTIONAL',
  'USER_EARNED',
  'USER_RESERVED',
  'PLATFORM_TREASURY',
  'PLATFORM_PROMO_ISSUANCE',
  'PLATFORM_REVENUE',
  'REFUND_CLEARING',
  'EXTERNAL'
);

ALTER TABLE "LedgerAccount" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "LedgerAccount"
  ALTER COLUMN "kind" TYPE "LedgerAccountKind_new"
  USING (
    CASE "kind"::text
      WHEN 'USER_BUCKET' THEN
        CASE COALESCE("bucket"::text, 'PURCHASED')
          WHEN 'PURCHASED' THEN 'USER_PURCHASED'::"LedgerAccountKind_new"
          WHEN 'PROMOTIONAL' THEN 'USER_PROMOTIONAL'::"LedgerAccountKind_new"
          WHEN 'EARNED' THEN 'USER_EARNED'::"LedgerAccountKind_new"
          WHEN 'RESERVED' THEN 'USER_RESERVED'::"LedgerAccountKind_new"
          ELSE 'USER_PURCHASED'::"LedgerAccountKind_new"
        END
      WHEN 'PLATFORM_FEE' THEN 'PLATFORM_REVENUE'::"LedgerAccountKind_new"
      WHEN 'EXTERNAL' THEN 'EXTERNAL'::"LedgerAccountKind_new"
      ELSE 'EXTERNAL'::"LedgerAccountKind_new"
    END
  );

DROP TYPE "LedgerAccountKind";
ALTER TYPE "LedgerAccountKind_new" RENAME TO "LedgerAccountKind";

-- CoinWallet upgrades
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "status" "CoinWalletStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "currency" "CoinCurrency" NOT NULL DEFAULT 'KOBA_COIN';
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "purchasedBalance" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "promotionalBalance" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "earnedBalance" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "CoinWallet" ADD COLUMN IF NOT EXISTS "reservedBalance" BIGINT NOT NULL DEFAULT 0;

-- LedgerTransaction upgrades
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "status" "LedgerTxStatus" NOT NULL DEFAULT 'POSTED';
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "walletId" TEXT;
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "metadataJson" TEXT;
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3);
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "reversesTxId" TEXT;
ALTER TABLE "LedgerTransaction" ADD COLUMN IF NOT EXISTS "reversedByTxId" TEXT;

UPDATE "LedgerTransaction"
SET "idempotencyKey" = 'legacy:' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "LedgerTransaction" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerTransaction_reversesTxId_key" ON "LedgerTransaction"("reversesTxId");
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerTransaction_reversedByTxId_key" ON "LedgerTransaction"("reversedByTxId");
CREATE INDEX IF NOT EXISTS "LedgerTransaction_walletId_createdAt_idx" ON "LedgerTransaction"("walletId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerTransaction_actorUserId_createdAt_idx" ON "LedgerTransaction"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerTransaction_status_createdAt_idx" ON "LedgerTransaction"("status", "createdAt");

UPDATE "LedgerTransaction" SET "postedAt" = "createdAt" WHERE "postedAt" IS NULL;

-- LedgerEntry amount -> BIGINT + classification
ALTER TABLE "LedgerEntry" ALTER COLUMN "amount" TYPE BIGINT USING "amount"::BIGINT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "classification" "CoinBucket";

-- Drop cascade delete on entries (immutability): recreate FK as RESTRICT if needed
ALTER TABLE "LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_transactionId_fkey";
ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerTransaction"
  ADD CONSTRAINT "LedgerTransaction_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "CoinWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction"
  ADD CONSTRAINT "LedgerTransaction_reversesTxId_fkey"
  FOREIGN KEY ("reversesTxId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CoinReservation
CREATE TABLE IF NOT EXISTS "CoinReservation" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "allocationsJson" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "CoinReservationStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "metadataJson" TEXT,
  "reserveTxId" TEXT,
  "captureTxId" TEXT,
  "releaseTxId" TEXT,
  "capturedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoinReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoinReservation_publicRef_key" ON "CoinReservation"("publicRef");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinReservation_idempotencyKey_key" ON "CoinReservation"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinReservation_reserveTxId_key" ON "CoinReservation"("reserveTxId");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinReservation_captureTxId_key" ON "CoinReservation"("captureTxId");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinReservation_releaseTxId_key" ON "CoinReservation"("releaseTxId");
CREATE INDEX IF NOT EXISTS "CoinReservation_walletId_status_idx" ON "CoinReservation"("walletId", "status");
CREATE INDEX IF NOT EXISTS "CoinReservation_status_expiresAt_idx" ON "CoinReservation"("status", "expiresAt");

ALTER TABLE "CoinReservation"
  ADD CONSTRAINT "CoinReservation_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "CoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinReservation"
  ADD CONSTRAINT "CoinReservation_reserveTxId_fkey"
  FOREIGN KEY ("reserveTxId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoinReservation"
  ADD CONSTRAINT "CoinReservation_captureTxId_fkey"
  FOREIGN KEY ("captureTxId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoinReservation"
  ADD CONSTRAINT "CoinReservation_releaseTxId_fkey"
  FOREIGN KEY ("releaseTxId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- System accounts (idempotent) — fixed IDs for deterministic seeds
INSERT INTO "LedgerAccount" ("id", "kind", "code", "createdAt")
VALUES
  ('sys_platform_treasury', 'PLATFORM_TREASURY', 'platform:treasury', CURRENT_TIMESTAMP),
  ('sys_platform_promo', 'PLATFORM_PROMO_ISSUANCE', 'platform:promo-issuance', CURRENT_TIMESTAMP),
  ('sys_platform_revenue', 'PLATFORM_REVENUE', 'platform:revenue', CURRENT_TIMESTAMP),
  ('sys_refund_clearing', 'REFUND_CLEARING', 'platform:refund-clearing', CURRENT_TIMESTAMP),
  ('sys_external_settlement', 'EXTERNAL', 'external:settlement', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Map legacy system codes if present
UPDATE "LedgerAccount" SET "kind" = 'PLATFORM_REVENUE', "code" = 'platform:revenue'
WHERE "code" = 'platform:fee' AND NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = 'platform:revenue');
UPDATE "LedgerAccount" SET "kind" = 'EXTERNAL', "code" = 'external:settlement'
WHERE "code" = 'external:stripe' AND NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = 'external:settlement');
