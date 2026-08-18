-- CreateEnum
CREATE TYPE "OAuthDeviceGrantStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "appliedGame" TEXT;

-- CreateTable
CREATE TABLE "OAuthDeviceGrant" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "OAuthDeviceGrantStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "pollIntervalSeconds" INTEGER NOT NULL DEFAULT 5,
    "lastPolledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthDeviceGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccessToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "steamId64" TEXT NOT NULL,
    "personaName" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthDeviceGrant_deviceCodeHash_key" ON "OAuthDeviceGrant"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthDeviceGrant_userCode_key" ON "OAuthDeviceGrant"("userCode");

-- CreateIndex
CREATE INDEX "OAuthDeviceGrant_userId_idx" ON "OAuthDeviceGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccessToken_tokenHash_key" ON "OAuthAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_userId_idx" ON "OAuthAccessToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SteamAccountLink_userId_key" ON "SteamAccountLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SteamAccountLink_steamId64_key" ON "SteamAccountLink"("steamId64");

-- AddForeignKey
ALTER TABLE "OAuthDeviceGrant" ADD CONSTRAINT "OAuthDeviceGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamAccountLink" ADD CONSTRAINT "SteamAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

