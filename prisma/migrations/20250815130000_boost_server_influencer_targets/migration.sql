-- Boost target list expanded per client clarification (2026-08-15):
-- "boost are just a way for players to support their favorite shops,
-- servers and influencers" — GameServer and influencer profiles are
-- real, existing entities, so they join PRODUCT/SHOP/GROUP as boostable
-- targets.

ALTER TYPE "BoostTargetKind" ADD VALUE 'SERVER';
ALTER TYPE "BoostTargetKind" ADD VALUE 'INFLUENCER';
