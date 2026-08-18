-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('DISCORD', 'TWITTER', 'YOUTUBE', 'TWITCH');

-- CreateTable
CREATE TABLE "UserSocialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT NOT NULL,
    "profileUrl" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSocialConnection" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT NOT NULL,
    "profileUrl" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSocialConnection_userId_idx" ON "UserSocialConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSocialConnection_userId_provider_key" ON "UserSocialConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "ShopSocialConnection_shopId_idx" ON "ShopSocialConnection"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSocialConnection_shopId_provider_key" ON "ShopSocialConnection"("shopId", "provider");

-- AddForeignKey
ALTER TABLE "UserSocialConnection" ADD CONSTRAINT "UserSocialConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSocialConnection" ADD CONSTRAINT "ShopSocialConnection_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

