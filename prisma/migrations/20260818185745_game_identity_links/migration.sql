-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'XBOX_ACCOUNT_LINKED';
ALTER TYPE "AuditAction" ADD VALUE 'XBOX_ACCOUNT_UNLINKED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAYSTATION_ACCOUNT_LINKED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAYSTATION_ACCOUNT_UNLINKED';

-- CreateTable
CREATE TABLE "XboxAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gamertag" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XboxAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayStationAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "psnUsername" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayStationAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XboxAccountLink_userId_key" ON "XboxAccountLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "XboxAccountLink_gamertag_key" ON "XboxAccountLink"("gamertag");

-- CreateIndex
CREATE UNIQUE INDEX "PlayStationAccountLink_userId_key" ON "PlayStationAccountLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayStationAccountLink_psnUsername_key" ON "PlayStationAccountLink"("psnUsername");

-- AddForeignKey
ALTER TABLE "XboxAccountLink" ADD CONSTRAINT "XboxAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayStationAccountLink" ADD CONSTRAINT "PlayStationAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

