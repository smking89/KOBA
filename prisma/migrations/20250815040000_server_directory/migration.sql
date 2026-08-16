-- Phase 14D: game server directory, verification, status snapshots, favourites

ALTER TYPE "AuditAction" ADD VALUE 'SERVER_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'SERVER_STATUS_POLL';

ALTER TYPE "ServerCapability" ADD VALUE 'MAP_SIZE';
ALTER TYPE "ServerCapability" ADD VALUE 'PING';
ALTER TYPE "ServerCapability" ADD VALUE 'PUBLIC_QUERY';
ALTER TYPE "ServerCapability" ADD VALUE 'JOIN_LINK';

ALTER TYPE "ServerOnlineStatus" ADD VALUE 'DEGRADED';

CREATE TYPE "ServerVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "ServerPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

ALTER TABLE "GameServer" ADD COLUMN "description" TEXT;
ALTER TABLE "GameServer" ADD COLUMN "country" TEXT;
ALTER TABLE "GameServer" ADD COLUMN "timezone" TEXT;
ALTER TABLE "GameServer" ADD COLUMN "hostname" TEXT;
ALTER TABLE "GameServer" ADD COLUMN "queryPort" INTEGER;
ALTER TABLE "GameServer" ADD COLUMN "gamePort" INTEGER;
ALTER TABLE "GameServer" ADD COLUMN "hideResolvedIp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GameServer" ADD COLUMN "adapterKey" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "GameServer" ADD COLUMN "verificationStatus" "ServerVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "GameServer" ADD COLUMN "publicationStatus" "ServerPublicationStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "GameServer" ADD COLUMN "operationalStatus" "ServerOnlineStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "GameServer" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "GameServer" ADD COLUMN "verificationNote" TEXT;
ALTER TABLE "GameServer" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "GameServer" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "GameServer" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "GameServer" ADD COLUMN "lastSuccessfulAt" TIMESTAMP(3);
ALTER TABLE "GameServer" ADD COLUMN "freshUntil" TIMESTAMP(3);
ALTER TABLE "GameServer" ADD COLUMN "pollFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GameServer" ADD COLUMN "nextPollAt" TIMESTAMP(3);
ALTER TABLE "GameServer" ADD COLUMN "ownerAccountType" "KobaAccountType" NOT NULL DEFAULT 'BUSINESS';

UPDATE "GameServer" SET "operationalStatus" = "status";

CREATE TABLE "ServerStatusSnapshot" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "operationalState" "ServerOnlineStatus" NOT NULL,
    "livePlayers" INTEGER,
    "maxPlayers" INTEGER,
    "queue" INTEGER,
    "mapName" TEXT,
    "mapSize" TEXT,
    "pingMs" INTEGER,
    "adapterKey" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "successfulAt" TIMESTAMP(3),
    "freshUntil" TIMESTAMP(3),
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerStatusSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerFavourite" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerFavourite_pkey" PRIMARY KEY ("userId","serverId")
);

CREATE INDEX "GameServer_publicationStatus_verificationStatus_idx" ON "GameServer"("publicationStatus", "verificationStatus");
CREATE INDEX "GameServer_operationalStatus_nextPollAt_idx" ON "GameServer"("operationalStatus", "nextPollAt");
CREATE INDEX "GameServer_slug_idx" ON "GameServer"("slug");
CREATE INDEX "ServerStatusSnapshot_serverId_checkedAt_idx" ON "ServerStatusSnapshot"("serverId", "checkedAt");
CREATE INDEX "ServerStatusSnapshot_checkedAt_idx" ON "ServerStatusSnapshot"("checkedAt");
CREATE INDEX "ServerFavourite_serverId_idx" ON "ServerFavourite"("serverId");

ALTER TABLE "ServerStatusSnapshot" ADD CONSTRAINT "ServerStatusSnapshot_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerFavourite" ADD CONSTRAINT "ServerFavourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerFavourite" ADD CONSTRAINT "ServerFavourite_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
