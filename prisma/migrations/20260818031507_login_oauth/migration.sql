-- CreateEnum
CREATE TYPE "LoginOAuthProvider" AS ENUM ('DISCORD', 'GOOGLE', 'STEAM');

-- CreateTable
CREATE TABLE "UserLoginIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "LoginOAuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthLoginTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthLoginTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLoginIdentity_userId_idx" ON "UserLoginIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLoginIdentity_provider_providerUserId_key" ON "UserLoginIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLoginIdentity_userId_provider_key" ON "UserLoginIdentity"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthLoginTicket_tokenHash_key" ON "OAuthLoginTicket"("tokenHash");

-- CreateIndex
CREATE INDEX "OAuthLoginTicket_userId_idx" ON "OAuthLoginTicket"("userId");

-- AddForeignKey
ALTER TABLE "UserLoginIdentity" ADD CONSTRAINT "UserLoginIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthLoginTicket" ADD CONSTRAINT "OAuthLoginTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

