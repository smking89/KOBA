-- Phase 14C: Inventory ownership + secure trading

ALTER TYPE "TradeState" ADD VALUE 'VOIDED';

CREATE TYPE "InventoryItemStatus" AS ENUM (
  'ACTIVE', 'TRADE_LOCKED', 'AUCTION_LOCKED', 'ORDER_LOCKED', 'DISPUTE_LOCKED', 'TRANSFERRED', 'REVOKED'
);
CREATE TYPE "InventoryAcquisitionSource" AS ENUM (
  'PURCHASE', 'GENERATION', 'TRADE', 'GRANT', 'SEED', 'MINT'
);
CREATE TYPE "TradeEventType" AS ENUM (
  'CREATED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COUNTERED', 'EXPIRED', 'COMPLETED', 'DISPUTED', 'VOIDED', 'LOCKED', 'UNLOCKED'
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "game" TEXT NOT NULL,
  "platform" "GamePlatform" NOT NULL,
  "rarity" "ProductRarity" NOT NULL,
  "transferable" BOOLEAN NOT NULL DEFAULT false,
  "listedForTrade" BOOLEAN NOT NULL DEFAULT false,
  "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "acquisitionSource" "InventoryAcquisitionSource" NOT NULL DEFAULT 'GRANT',
  "productId" TEXT,
  "aidenAssetId" TEXT,
  "serial" TEXT,
  "lockTradeOfferId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryItem_publicRef_key" ON "InventoryItem"("publicRef");
CREATE INDEX "InventoryItem_ownerUserId_listedForTrade_status_idx" ON "InventoryItem"("ownerUserId", "listedForTrade", "status");
CREATE INDEX "InventoryItem_rarity_game_idx" ON "InventoryItem"("rarity", "game");
CREATE INDEX "InventoryItem_lockTradeOfferId_idx" ON "InventoryItem"("lockTradeOfferId");
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rebuild TradeOfferItem around inventory ownership
DROP TABLE IF EXISTS "TradeOfferItem";

ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "rarityTier" "ProductRarity";
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "parentTradeId" TEXT;
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

UPDATE "TradeOffer" SET "idempotencyKey" = 'legacy:' || "id" WHERE "idempotencyKey" IS NULL;
UPDATE "TradeOffer" SET "rarityTier" = 'COMMON' WHERE "rarityTier" IS NULL;

ALTER TABLE "TradeOffer" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "TradeOffer" ALTER COLUMN "rarityTier" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TradeOffer_idempotencyKey_key" ON "TradeOffer"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "TradeOffer_state_expiresAt_idx" ON "TradeOffer"("state", "expiresAt");
CREATE INDEX IF NOT EXISTS "TradeOffer_parentTradeId_idx" ON "TradeOffer"("parentTradeId");

ALTER TABLE "TradeOffer"
  ADD CONSTRAINT "TradeOffer_parentTradeId_fkey"
  FOREIGN KEY ("parentTradeId") REFERENCES "TradeOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_lockTradeOfferId_fkey"
  FOREIGN KEY ("lockTradeOfferId") REFERENCES "TradeOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TradeOfferItem" (
  "id" TEXT NOT NULL,
  "tradeOfferId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "side" "TradeItemSide" NOT NULL,
  "titleSnapshot" TEXT NOT NULL,
  "gameSnapshot" TEXT NOT NULL,
  "platformSnapshot" "GamePlatform" NOT NULL,
  "raritySnapshot" "ProductRarity" NOT NULL,
  "ownerUserIdSnap" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeOfferItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradeOfferItem_tradeOfferId_inventoryItemId_key" ON "TradeOfferItem"("tradeOfferId", "inventoryItemId");
CREATE INDEX "TradeOfferItem_tradeOfferId_side_idx" ON "TradeOfferItem"("tradeOfferId", "side");
CREATE INDEX "TradeOfferItem_inventoryItemId_idx" ON "TradeOfferItem"("inventoryItemId");

ALTER TABLE "TradeOfferItem"
  ADD CONSTRAINT "TradeOfferItem_tradeOfferId_fkey"
  FOREIGN KEY ("tradeOfferId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeOfferItem"
  ADD CONSTRAINT "TradeOfferItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TradeEvent" (
  "id" TEXT NOT NULL,
  "tradeOfferId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" "TradeEventType" NOT NULL,
  "fromState" "TradeState",
  "toState" "TradeState",
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeEvent_tradeOfferId_createdAt_idx" ON "TradeEvent"("tradeOfferId", "createdAt");
ALTER TABLE "TradeEvent"
  ADD CONSTRAINT "TradeEvent_tradeOfferId_fkey"
  FOREIGN KEY ("tradeOfferId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeEvent"
  ADD CONSTRAINT "TradeEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
