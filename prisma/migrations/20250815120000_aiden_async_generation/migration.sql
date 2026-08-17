-- Phase 14G: Aiden asynchronous concept generation

-- AIDEN_JOB_COMPLETED already added by 20250815070000_aiden_generation_pipeline —
-- this line duplicated it, which fails ALTER TYPE ... ADD VALUE on any fresh
-- database (confirmed via a shadow-database replay failure, not just here).
ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_ASSET_REVIEW_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_ASSET_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_ASSET_REJECTED';

ALTER TYPE "AidenTechnicalStatus" ADD VALUE 'CONCEPT';
ALTER TYPE "AidenTechnicalStatus" ADD VALUE 'APPROVED_FOR_MARKETPLACE';

ALTER TYPE "AidenJobState" ADD VALUE 'DRAFT';
ALTER TYPE "AidenJobState" ADD VALUE 'MODERATING';
ALTER TYPE "AidenJobState" ADD VALUE 'SUCCEEDED';

CREATE TYPE "AidenPromptModeration" AS ENUM ('PENDING', 'ALLOWED', 'BLOCKED');
CREATE TYPE "AidenOutputModeration" AS ENUM ('PENDING', 'CLEAR', 'FLAGGED', 'BLOCKED');
CREATE TYPE "AidenFailureClass" AS ENUM ('PROVIDER', 'VALIDATION', 'MODERATION', 'STORAGE', 'COST', 'CANCELLED', 'INTERNAL');

ALTER TABLE "AidenJob" ADD COLUMN "kobaIdentityId" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "promptHash" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "settingsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "AidenJob" ADD COLUMN "estimatedCostCoins" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "AidenJob" ADD COLUMN "actualCostCoins" BIGINT;
ALTER TABLE "AidenJob" ADD COLUMN "reservationPublicRef" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE "AidenJob" ADD COLUMN "model" TEXT NOT NULL DEFAULT 'aiden-mock-concept';
ALTER TABLE "AidenJob" ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "AidenJob" ADD COLUMN "providerRequestId" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "promptModeration" "AidenPromptModeration" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AidenJob" ADD COLUMN "outputModeration" "AidenOutputModeration" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AidenJob" ADD COLUMN "failureClass" "AidenFailureClass";
ALTER TABLE "AidenJob" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AidenJob" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "AidenJob" ADD COLUMN "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AidenJob" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "AidenJob" ADD COLUMN "claimedBy" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AidenJob" ADD COLUMN "outputStorageKey" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "outputMime" TEXT;
ALTER TABLE "AidenJob" ADD COLUMN "outputBytes" BYTEA;
ALTER TABLE "AidenJob" ADD COLUMN "outputByteSize" INTEGER;
ALTER TABLE "AidenJob" ADD COLUMN "outputWidth" INTEGER;
ALTER TABLE "AidenJob" ADD COLUMN "outputHeight" INTEGER;
ALTER TABLE "AidenJob" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);

UPDATE "AidenJob" SET "estimatedCostCoins" = "coinCostPreview", "reservationPublicRef" = "reservationTxId";

CREATE UNIQUE INDEX "AidenJob_providerRequestId_key" ON "AidenJob"("providerRequestId");
CREATE UNIQUE INDEX "AidenJob_idempotencyKey_key" ON "AidenJob"("idempotencyKey");
CREATE INDEX "AidenJob_state_runAfter_idx" ON "AidenJob"("state", "runAfter");
CREATE INDEX "AidenJob_state_claimedAt_idx" ON "AidenJob"("state", "claimedAt");

ALTER TABLE "AidenJob" ADD CONSTRAINT "AidenJob_kobaIdentityId_fkey" FOREIGN KEY ("kobaIdentityId") REFERENCES "KobaIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AidenAsset" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "AidenAsset" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "AidenAsset" ADD COLUMN "byteSize" INTEGER;
ALTER TABLE "AidenAsset" ADD COLUMN "width" INTEGER;
ALTER TABLE "AidenAsset" ADD COLUMN "height" INTEGER;
ALTER TABLE "AidenAsset" ADD COLUMN "provider" TEXT;
ALTER TABLE "AidenAsset" ADD COLUMN "model" TEXT;
ALTER TABLE "AidenAsset" ADD COLUMN "modelVersion" TEXT;
ALTER TABLE "AidenAsset" ADD COLUMN "provenanceJson" TEXT;

CREATE INDEX IF NOT EXISTS "AidenAsset_moderation_idx" ON "AidenAsset"("moderation");
