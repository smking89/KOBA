import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hasScope, resolveAccessToken } from "@/features/oauth-device/lib/access-token";

export const dynamic = "force-dynamic";

const schema = z.object({ game: z.string().trim().min(1).max(120) });

/** The plugin calls this after it actually writes the item into a
 * game's local skin config — distinct from merely owning it. */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const resolved = await resolveAccessToken(request);
  if (!resolved) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!hasScope(resolved, "inventory:write")) {
    return NextResponse.json({ error: "Missing inventory:write scope." }, { status: 403 });
  }

  const { itemId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, ownerUserId: resolved.userId },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const updated = await prisma.inventoryItem.update({
    where: { id: item.id },
    data: { appliedAt: new Date(), appliedGame: parsed.data.game },
    select: { id: true, appliedAt: true, appliedGame: true },
  });

  return NextResponse.json({ item: updated });
}
