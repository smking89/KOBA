-- Freebie Products (ROADMAP.md Phase 18): sellers mark a product free
-- (permanently, or for a fixed initial quantity), buyers claim via a $0
-- order that bypasses Stripe entirely.

ALTER TYPE "AuditAction" ADD VALUE 'FREEBIE_CLAIMED';

CREATE TYPE "FreebiePolicy" AS ENUM ('NONE', 'PERMANENT', 'LIMITED_QUANTITY');

ALTER TABLE "Product" ADD COLUMN "freebiePolicy" "FreebiePolicy" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Product" ADD COLUMN "freebieQuantityRemaining" INTEGER;

CREATE INDEX "Product_freebiePolicy_idx" ON "Product"("freebiePolicy");

CREATE TABLE "FreebieClaim" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "buyerUserId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FreebieClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreebieClaim_orderId_key" ON "FreebieClaim"("orderId");
CREATE UNIQUE INDEX "FreebieClaim_productId_buyerUserId_key" ON "FreebieClaim"("productId", "buyerUserId");
CREATE INDEX "FreebieClaim_buyerUserId_idx" ON "FreebieClaim"("buyerUserId");

ALTER TABLE "FreebieClaim" ADD CONSTRAINT "FreebieClaim_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FreebieClaim" ADD CONSTRAINT "FreebieClaim_buyerUserId_fkey"
  FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FreebieClaim" ADD CONSTRAINT "FreebieClaim_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
