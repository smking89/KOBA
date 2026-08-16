-- Reconciles two pieces of schema drift found while building the Phase 22
-- kit-delivery migration (prisma migrate dev auto-detected these, but they
-- were reverted out of that unrelated migration and fixed properly here).
--
-- Both directions were verified before applying, not guessed:
--
-- 1. TradeOffer_state_createdAt_idx (from 20250815010000) has no matching
--    @@index in the current TradeOffer model — it was superseded by
--    @@index([state, expiresAt]), a better fit for trade-offer queries
--    (checking expiry), not an accidental drop.
-- 2. Order.sellerPayoutCents lost its DEFAULT 0 (originally set in
--    20250814220000) — schema.prisma no longer declares one. Verified
--    every Order-creation call site (checkout.service.ts's paid-order
--    path and its Phase 18 freebie path) already sets sellerPayoutCents
--    explicitly, so nothing relies on the implicit default.

DROP INDEX IF EXISTS "TradeOffer_state_createdAt_idx";

ALTER TABLE "Order" ALTER COLUMN "sellerPayoutCents" DROP DEFAULT;
