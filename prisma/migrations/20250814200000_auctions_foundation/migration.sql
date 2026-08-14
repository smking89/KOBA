-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'BID_PLACED';
ALTER TYPE "AuditAction" ADD VALUE 'AUCTION_SETTLED';

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'RESERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('ACTIVE', 'OUTBID', 'WON', 'VOID');

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startingBidCents" INTEGER NOT NULL,
    "minIncrementCents" INTEGER NOT NULL,
    "highBidCents" INTEGER,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "winnerUserId" TEXT,
    "reservedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auction_productId_key" ON "Auction"("productId");

-- CreateIndex
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Auction_winnerUserId_idx" ON "Auction"("winnerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_idempotencyKey_key" ON "Bid"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Bid_auctionId_amountCents_idx" ON "Bid"("auctionId", "amountCents");

-- CreateIndex
CREATE INDEX "Bid_bidderUserId_createdAt_idx" ON "Bid"("bidderUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderUserId_fkey" FOREIGN KEY ("bidderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
