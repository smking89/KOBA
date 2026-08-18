import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasScope, resolveAccessToken } from "@/features/oauth-device/lib/access-token";

export const dynamic = "force-dynamic";

/** What the PC Plugin actually applies — purchased or Aiden-generated
 * skins the player owns right now, not every InventoryItem ever granted
 * (roadmap: "filtered to purchased/Aiden-generated skins"). */
export async function GET(request: Request) {
  const resolved = await resolveAccessToken(request);
  if (!resolved) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!hasScope(resolved, "inventory:read")) {
    return NextResponse.json({ error: "Missing inventory:read scope." }, { status: 403 });
  }

  const items = await prisma.inventoryItem.findMany({
    where: {
      ownerUserId: resolved.userId,
      status: "ACTIVE",
      acquisitionSource: { in: ["PURCHASE", "GENERATION"] },
    },
    select: {
      id: true,
      publicRef: true,
      title: true,
      game: true,
      platform: true,
      rarity: true,
      serial: true,
      appliedAt: true,
      appliedGame: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}
