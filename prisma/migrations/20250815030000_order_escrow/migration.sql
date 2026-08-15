-- AlterEnum AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_ESCROW_RELEASED';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_ESCROW_DISPUTED';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_ESCROW_DISPUTE_RESOLVED';

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HOLDING', 'DISPUTED', 'RELEASED', 'REFUNDED');

-- CreateTable
CREATE TABLE "OrderEscrow" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HOLDING',
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "disputedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "stripeTransferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderEscrow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderEscrow_orderId_key" ON "OrderEscrow"("orderId");
CREATE INDEX "OrderEscrow_status_releaseAt_idx" ON "OrderEscrow"("status", "releaseAt");

-- AddForeignKey
ALTER TABLE "OrderEscrow" ADD CONSTRAINT "OrderEscrow_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderEscrow" ADD CONSTRAINT "OrderEscrow_disputedByUserId_fkey" FOREIGN KEY ("disputedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderEscrow" ADD CONSTRAINT "OrderEscrow_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
