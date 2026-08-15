import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/http/client-ip";
import { jsonTradeError } from "@/features/trade/lib/http";
import { listTradeableInventory } from "@/features/inventory/services/inventory.service";
import type { GamePlatform, ProductRarity } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

const PLATFORMS = new Set(["PC", "STEAM", "XBOX", "PLAYSTATION"]);
const RARITIES = new Set(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "RELIC"]);

export async function GET(request: Request) {
  const limited = await rateLimit(`inventory-tradeable:${clientIp(request)}`, 90, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many inventory requests." },
      { status: 429, headers: noStore },
    );
  }

  const url = new URL(request.url);
  const game = url.searchParams.get("game") ?? undefined;
  const query = url.searchParams.get("query") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const platformParam = url.searchParams.get("platform");
  const rarityParam = url.searchParams.get("rarity");

  const platform =
    platformParam && PLATFORMS.has(platformParam) ? (platformParam as GamePlatform) : undefined;
  const rarity =
    rarityParam && RARITIES.has(rarityParam) ? (rarityParam as ProductRarity) : undefined;

  try {
    const result = await listTradeableInventory({
      ...(game ? { game } : {}),
      ...(platform ? { platform } : {}),
      ...(rarity ? { rarity } : {}),
      ...(query ? { query } : {}),
      ...(cursor ? { cursor } : {}),
      ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
    });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    return jsonTradeError(error, "Could not load tradeable inventory.");
  }
}
