-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_COMMENT_POSTED';

-- CreateTable
CREATE TABLE "ProductComment" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "moderationStatus" "PostModeration" NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductComment_publicRef_key" ON "ProductComment"("publicRef");

-- CreateIndex
CREATE INDEX "ProductComment_productId_createdAt_idx" ON "ProductComment"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductComment_authorUserId_idx" ON "ProductComment"("authorUserId");

-- AddForeignKey
ALTER TABLE "ProductComment" ADD CONSTRAINT "ProductComment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComment" ADD CONSTRAINT "ProductComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
