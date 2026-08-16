-- Aiden real generation pipeline: cost-reconciliation audit fields on
-- AidenJob, output location on AidenAsset, and two new AuditAction values
-- for the completed/failed outcomes the stub-only pipeline never reached.

ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_JOB_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'AIDEN_JOB_FAILED';

ALTER TABLE "AidenJob" ADD COLUMN "coinCostActual" INTEGER;
ALTER TABLE "AidenJob" ADD COLUMN "frontierModelUsageJson" TEXT;

ALTER TABLE "AidenAsset" ADD COLUMN "assetUrl" TEXT;
