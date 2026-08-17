-- CreateTable
CREATE TABLE "ProductSave" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSave_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateIndex
CREATE INDEX "ProductSave_productId_idx" ON "ProductSave"("productId");

-- AddForeignKey
ALTER TABLE "ProductSave" ADD CONSTRAINT "ProductSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSave" ADD CONSTRAINT "ProductSave_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
