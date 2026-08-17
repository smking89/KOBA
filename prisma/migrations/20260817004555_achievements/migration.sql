-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('ACCOUNT_AGE', 'TRADING', 'MARKETPLACE', 'COMMUNITY', 'SPECIAL');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ACHIEVEMENT_UNLOCKED';

-- DropIndex
DROP INDEX "AidenJob_state_createdAt_idx";

-- AlterTable
ALTER TABLE "DevProduct" ALTER COLUMN "games" DROP DEFAULT,
ALTER COLUMN "operatingSystems" DROP DEFAULT,
ALTER COLUMN "serverPlatforms" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DevProductVersion" ALTER COLUMN "gameVersions" DROP DEFAULT,
ALTER COLUMN "platforms" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperApiKey" ALTER COLUMN "scopes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperApplication" ALTER COLUMN "scopes" DROP DEFAULT,
ALTER COLUMN "redirectUris" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperProfile" ALTER COLUMN "games" DROP DEFAULT,
ALTER COLUMN "platforms" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperWebhookEndpoint" ALTER COLUMN "events" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GameServer" ALTER COLUMN "ownerAccountType" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rarity" "ProductRarity" NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "DevProduct_slug_idx" ON "DevProduct"("slug");

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
