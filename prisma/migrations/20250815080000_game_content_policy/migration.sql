-- Per-game marketplace content policy, from the ARK deep-dive + per-title
-- ToS sweep (2026-08-14). See docs/game-content-policy.md.

CREATE TYPE "GameContentPolicy" AS ENUM ('FULL', 'SKINS_ONLY', 'EXCLUDED', 'LEGAL_REVIEW');

ALTER TABLE "Game" ADD COLUMN "contentPolicy" "GameContentPolicy" NOT NULL DEFAULT 'FULL';
ALTER TABLE "Game" ADD COLUMN "policyNote" TEXT;
