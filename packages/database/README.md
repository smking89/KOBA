# packages/database

Prisma schema + migrations — the Phase 12 integration point. `prisma/schema.prisma`
is where every model from Phases 1-11 gets reconciled into one schema (Users,
KOBAID ledger, Products, Cosmetics, Auctions, Bids, Orders, Shops, Groups,
LFG posts, SocialActions, TagActions, Ads, Feed units, Developer portal
assets, Influencer promo codes, Influencer earnings, Role permissions).

Empty until Phase 12. Individual modules can sketch their own model shapes
in their phase README under `apps/api/src/modules/*` before then, but the
canonical schema lives here.
