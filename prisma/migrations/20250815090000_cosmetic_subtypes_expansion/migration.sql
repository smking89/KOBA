-- Expand CosmeticSubType to match the full subscription-perk catalog
-- confirmed for KOBA Plus (Phase 16): profile frames, shop banners, and
-- emojis, alongside the existing avatar decoration/profile effect/
-- nameplate set. Cosmetics remain universal (never game-gated) — see
-- docs/game-content-policy.md.

ALTER TYPE "CosmeticSubType" ADD VALUE 'PROFILE_FRAME';
ALTER TYPE "CosmeticSubType" ADD VALUE 'SHOP_BANNER';
ALTER TYPE "CosmeticSubType" ADD VALUE 'EMOJI';
