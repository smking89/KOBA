-- Links a successfully-generated AidenAsset to the Product it was
-- published as, closing the "publish to marketplace" gap noted in
-- ROADMAP.md Phase 14. Nullable/unique: an asset publishes at most once.

ALTER TABLE "AidenAsset" ADD COLUMN "publishedProductId" TEXT;

CREATE UNIQUE INDEX "AidenAsset_publishedProductId_key" ON "AidenAsset"("publishedProductId");

ALTER TABLE "AidenAsset" ADD CONSTRAINT "AidenAsset_publishedProductId_fkey"
  FOREIGN KEY ("publishedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
