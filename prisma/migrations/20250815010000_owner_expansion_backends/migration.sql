-- AlterEnum AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'TRADE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TRADE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_REGISTERED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_RCON_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLUS_CHECKOUT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'PLUS_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'COIN_LEDGER_POSTED';
ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_JOB_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_JOB_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PRODUCT_SUBMITTED';

-- AlterEnum ReportTargetType
ALTER TYPE "ReportTargetType" ADD VALUE 'TRADE';
ALTER TYPE "ReportTargetType" ADD VALUE 'SERVER';
ALTER TYPE "ReportTargetType" ADD VALUE 'AIDEN_ASSET';
ALTER TYPE "ReportTargetType" ADD VALUE 'DEV_PRODUCT';

-- CreateEnum
CREATE TYPE "TradeState" AS ENUM ('DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'DISPUTED', 'COUNTERED');
CREATE TYPE "TradeItemSide" AS ENUM ('OFFERED', 'REQUESTED');
CREATE TYPE "ServerPlatformFamily" AS ENUM ('PC', 'CONSOLE');
CREATE TYPE "ServerCapability" AS ENUM ('STATUS', 'PLAYER_COUNT', 'PLAYER_LIST', 'QUEUE_COUNT', 'MAP_INFO', 'RCON_READ', 'RCON_WRITE', 'PC', 'CONSOLE');
CREATE TYPE "ServerOnlineStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');
CREATE TYPE "RconTestState" AS ENUM ('IDLE', 'TESTING', 'SUCCESS', 'TIMEOUT', 'AUTH_FAILED', 'UNSUPPORTED');
CREATE TYPE "PlusPlanInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "PlusSubscriptionState" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "CoinBucket" AS ENUM ('PURCHASED', 'PROMOTIONAL', 'EARNED', 'RESERVED');
CREATE TYPE "LedgerAccountKind" AS ENUM ('USER_BUCKET', 'PLATFORM_FEE', 'EXTERNAL');
CREATE TYPE "LedgerEntrySide" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "CoinTxCategory" AS ENUM ('PURCHASE', 'GENERATION_RESERVATION', 'CAPTURE', 'RELEASE', 'REFUND', 'SELLER_EARNING', 'PLATFORM_FEE', 'PROMOTIONAL_GRANT');
CREATE TYPE "AidenAssetType" AS ENUM ('CONCEPT_IMAGE', 'SKIN', 'TEXTURE', 'PROP', 'ANIMATION', 'TERRAIN', 'MAP');
CREATE TYPE "AidenTechnicalStatus" AS ENUM ('CONCEPT_ONLY', 'PREVIEW', 'REQUIRES_CONVERSION', 'GAME_READY', 'VALIDATION_FAILED');
CREATE TYPE "AidenJobState" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AidenModerationState" AS ENUM ('PRIVATE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'HIDDEN');
CREATE TYPE "DevProductKind" AS ENUM ('APPLICATION', 'PLUGIN');
CREATE TYPE "DevPricing" AS ENUM ('FREE', 'PAID');
CREATE TYPE "DevReviewState" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'SECURITY_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "state" "TradeState" NOT NULL DEFAULT 'PENDING',
    "proposerUserId" TEXT NOT NULL,
    "counterpartyUserId" TEXT NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeOfferItem" (
    "id" TEXT NOT NULL,
    "tradeOfferId" TEXT NOT NULL,
    "side" "TradeItemSide" NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "platform" "GamePlatform" NOT NULL,
    "rarity" "ProductRarity" NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "eligibilityNote" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeOfferItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameServer" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "platformFamily" "ServerPlatformFamily" NOT NULL,
    "region" TEXT NOT NULL,
    "tags" TEXT[],
    "ownerUserId" TEXT NOT NULL,
    "shopId" TEXT,
    "joinInfo" TEXT,
    "lastRefreshAt" TIMESTAMP(3),
    "capabilities" "ServerCapability"[],
    "status" "ServerOnlineStatus" NOT NULL DEFAULT 'UNKNOWN',
    "livePlayers" INTEGER,
    "maxPlayers" INTEGER,
    "queue" INTEGER,
    "mapName" TEXT,
    "mapSize" TEXT,
    "pingMs" INTEGER,
    "host" TEXT,
    "port" INTEGER,
    "rconTestState" "RconTestState" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameServer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerCredential" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServerCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlusSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "PlusSubscriptionState" NOT NULL DEFAULT 'NONE',
    "planId" TEXT,
    "interval" "PlusPlanInterval",
    "renewsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlusSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoinWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "walletId" TEXT,
    "userId" TEXT,
    "kind" "LedgerAccountKind" NOT NULL,
    "bucket" "CoinBucket",
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "category" "CoinTxCategory" NOT NULL,
    "memo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "side" "LedgerEntrySide" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AidenJob" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "assetType" "AidenAssetType" NOT NULL,
    "state" "AidenJobState" NOT NULL DEFAULT 'QUEUED',
    "coinCostPreview" INTEGER NOT NULL,
    "reservationTxId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AidenJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AidenAsset" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "assetType" "AidenAssetType" NOT NULL,
    "technicalStatus" "AidenTechnicalStatus" NOT NULL DEFAULT 'CONCEPT_ONLY',
    "moderation" "AidenModerationState" NOT NULL DEFAULT 'PRIVATE',
    "game" TEXT NOT NULL,
    "previewLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AidenAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevProduct" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "DevProductKind" NOT NULL,
    "name" TEXT NOT NULL,
    "pricing" "DevPricing" NOT NULL DEFAULT 'FREE',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "compatibility" TEXT[],
    "scopes" TEXT[],
    "reviewState" "DevReviewState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DevProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevInstall" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DevInstall_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "TradeOffer_publicRef_key" ON "TradeOffer"("publicRef");
CREATE INDEX "TradeOffer_proposerUserId_createdAt_idx" ON "TradeOffer"("proposerUserId", "createdAt");
CREATE INDEX "TradeOffer_counterpartyUserId_createdAt_idx" ON "TradeOffer"("counterpartyUserId", "createdAt");
CREATE INDEX "TradeOffer_state_createdAt_idx" ON "TradeOffer"("state", "createdAt");
CREATE INDEX "TradeOfferItem_tradeOfferId_side_idx" ON "TradeOfferItem"("tradeOfferId", "side");

CREATE UNIQUE INDEX "GameServer_publicRef_key" ON "GameServer"("publicRef");
CREATE UNIQUE INDEX "GameServer_slug_key" ON "GameServer"("slug");
CREATE INDEX "GameServer_ownerUserId_idx" ON "GameServer"("ownerUserId");
CREATE INDEX "GameServer_game_region_idx" ON "GameServer"("game", "region");
CREATE INDEX "GameServer_platformFamily_idx" ON "GameServer"("platformFamily");
CREATE UNIQUE INDEX "ServerCredential_serverId_key" ON "ServerCredential"("serverId");

CREATE UNIQUE INDEX "PlusSubscription_userId_key" ON "PlusSubscription"("userId");
CREATE UNIQUE INDEX "CoinWallet_userId_key" ON "CoinWallet"("userId");
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");
CREATE INDEX "LedgerAccount_walletId_idx" ON "LedgerAccount"("walletId");
CREATE INDEX "LedgerAccount_userId_kind_idx" ON "LedgerAccount"("userId", "kind");
CREATE UNIQUE INDEX "LedgerTransaction_publicRef_key" ON "LedgerTransaction"("publicRef");
CREATE INDEX "LedgerTransaction_category_createdAt_idx" ON "LedgerTransaction"("category", "createdAt");
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX "LedgerEntry_accountId_idx" ON "LedgerEntry"("accountId");

CREATE UNIQUE INDEX "AidenJob_publicRef_key" ON "AidenJob"("publicRef");
CREATE INDEX "AidenJob_userId_createdAt_idx" ON "AidenJob"("userId", "createdAt");
CREATE INDEX "AidenJob_state_createdAt_idx" ON "AidenJob"("state", "createdAt");
CREATE UNIQUE INDEX "AidenAsset_publicRef_key" ON "AidenAsset"("publicRef");
CREATE UNIQUE INDEX "AidenAsset_jobId_key" ON "AidenAsset"("jobId");
CREATE INDEX "AidenAsset_userId_createdAt_idx" ON "AidenAsset"("userId", "createdAt");
CREATE INDEX "AidenAsset_moderation_idx" ON "AidenAsset"("moderation");

CREATE UNIQUE INDEX "DevProduct_publicRef_key" ON "DevProduct"("publicRef");
CREATE INDEX "DevProduct_ownerUserId_idx" ON "DevProduct"("ownerUserId");
CREATE INDEX "DevProduct_kind_reviewState_idx" ON "DevProduct"("kind", "reviewState");
CREATE UNIQUE INDEX "DevInstall_productId_userId_key" ON "DevInstall"("productId", "userId");
CREATE INDEX "DevInstall_userId_idx" ON "DevInstall"("userId");

-- Foreign keys
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_proposerUserId_fkey" FOREIGN KEY ("proposerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_counterpartyUserId_fkey" FOREIGN KEY ("counterpartyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_tradeOfferId_fkey" FOREIGN KEY ("tradeOfferId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameServer" ADD CONSTRAINT "GameServer_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameServer" ADD CONSTRAINT "GameServer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServerCredential" ADD CONSTRAINT "ServerCredential_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlusSubscription" ADD CONSTRAINT "PlusSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinWallet" ADD CONSTRAINT "CoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AidenJob" ADD CONSTRAINT "AidenJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AidenAsset" ADD CONSTRAINT "AidenAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AidenAsset" ADD CONSTRAINT "AidenAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AidenJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DevProduct" ADD CONSTRAINT "DevProduct_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevInstall" ADD CONSTRAINT "DevInstall_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DevProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevInstall" ADD CONSTRAINT "DevInstall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
