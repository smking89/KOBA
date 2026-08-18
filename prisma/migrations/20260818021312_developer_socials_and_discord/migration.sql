-- AlterTable
ALTER TABLE "DevProduct" ADD COLUMN     "discordClientId" TEXT,
ADD COLUMN     "discordInviteUrl" TEXT,
ADD COLUMN     "discordVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DeveloperProfile" ADD COLUMN     "discordConnectedAt" TIMESTAMP(3),
ADD COLUMN     "discordServerUrl" TEXT,
ADD COLUMN     "discordUserId" TEXT,
ADD COLUMN     "discordUsername" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "twitterUrl" TEXT,
ADD COLUMN     "youtubeUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProfile_discordUserId_key" ON "DeveloperProfile"("discordUserId");
