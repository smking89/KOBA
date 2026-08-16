-- Phase 14E: encrypted Rust integration, attempts, jobs, owner notices

ALTER TYPE "AuditAction" ADD VALUE 'SERVER_INTEGRATION_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_INTEGRATION_TESTED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_CREDENTIAL_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_INTEGRATION_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_CAPABILITY_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_CIRCUIT_OPENED';

CREATE TYPE "ServerIntegrationProvider" AS ENUM ('RUST_PC');
CREATE TYPE "ServerIntegrationMode" AS ENUM ('PUBLIC_QUERY', 'RCON_READ');
CREATE TYPE "ServerIntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'DEGRADED', 'FAILED', 'REVOKED', 'DISCONNECTED');

CREATE TABLE "ServerIntegration" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "provider" "ServerIntegrationProvider" NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "mode" "ServerIntegrationMode" NOT NULL DEFAULT 'RCON_READ',
    "status" "ServerIntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "hostname" TEXT,
    "queryPort" INTEGER,
    "rconPort" INTEGER,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "lastHealthJson" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastFailureCategory" TEXT,
    "pollFailures" INTEGER NOT NULL DEFAULT 0,
    "nextPollAt" TIMESTAMP(3),
    "circuitOpenedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationAttempt" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "integrationId" TEXT,
    "attemptType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCategory" TEXT,
    "durationMs" INTEGER NOT NULL,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerIntegrationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "integrationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCategory" TEXT,
    "correlationId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerIntegrationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerOwnerNotice" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerOwnerNotice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationIdempotency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationIdempotency_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServerCredential" ADD COLUMN "integrationId" TEXT;
ALTER TABLE "ServerCredential" ADD COLUMN "keyVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ServerCredential" ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ServerCredential_integrationId_key" ON "ServerCredential"("integrationId");
CREATE UNIQUE INDEX "ServerIntegration_serverId_provider_key" ON "ServerIntegration"("serverId", "provider");
CREATE INDEX "ServerIntegration_status_nextPollAt_idx" ON "ServerIntegration"("status", "nextPollAt");
CREATE INDEX "ServerIntegration_serverId_idx" ON "ServerIntegration"("serverId");
CREATE INDEX "IntegrationAttempt_serverId_createdAt_idx" ON "IntegrationAttempt"("serverId", "createdAt");
CREATE INDEX "IntegrationAttempt_integrationId_createdAt_idx" ON "IntegrationAttempt"("integrationId", "createdAt");
CREATE INDEX "IntegrationAttempt_correlationId_idx" ON "IntegrationAttempt"("correlationId");
CREATE INDEX "ServerIntegrationJob_status_runAfter_idx" ON "ServerIntegrationJob"("status", "runAfter");
CREATE INDEX "ServerIntegrationJob_serverId_status_idx" ON "ServerIntegrationJob"("serverId", "status");
CREATE INDEX "ServerOwnerNotice_ownerUserId_createdAt_idx" ON "ServerOwnerNotice"("ownerUserId", "createdAt");
CREATE INDEX "ServerOwnerNotice_serverId_createdAt_idx" ON "ServerOwnerNotice"("serverId", "createdAt");
CREATE UNIQUE INDEX "IntegrationIdempotency_userId_serverId_action_key_key" ON "IntegrationIdempotency"("userId", "serverId", "action", "key");
CREATE INDEX "IntegrationIdempotency_createdAt_idx" ON "IntegrationIdempotency"("createdAt");

ALTER TABLE "ServerIntegration" ADD CONSTRAINT "ServerIntegration_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerCredential" ADD CONSTRAINT "ServerCredential_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ServerIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationAttempt" ADD CONSTRAINT "IntegrationAttempt_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationAttempt" ADD CONSTRAINT "IntegrationAttempt_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ServerIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServerIntegrationJob" ADD CONSTRAINT "ServerIntegrationJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerIntegrationJob" ADD CONSTRAINT "ServerIntegrationJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ServerIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServerOwnerNotice" ADD CONSTRAINT "ServerOwnerNotice_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerOwnerNotice" ADD CONSTRAINT "ServerOwnerNotice_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationIdempotency" ADD CONSTRAINT "IntegrationIdempotency_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
