-- Server "rarity" (client clarification 2026-08-15): derived from a Map
-- the server owner purchased on the KOBA marketplace and marked active
-- on this server — not a standalone field the owner sets directly.

ALTER TABLE "GameServer" ADD COLUMN "activeMapInventoryItemId" TEXT;

CREATE UNIQUE INDEX "GameServer_activeMapInventoryItemId_key" ON "GameServer"("activeMapInventoryItemId");

ALTER TABLE "GameServer" ADD CONSTRAINT "GameServer_activeMapInventoryItemId_fkey"
  FOREIGN KEY ("activeMapInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
