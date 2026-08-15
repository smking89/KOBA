import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { generateProductDescription } from "@/features/shops/services/product-description-assist.service";

const describeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  game: z.string().trim().min(1).max(64),
  category: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`describe-assist:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many description requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = describeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid description request." }, { status: 400 });
  }

  try {
    const result = await generateProductDescription(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(result);
  } catch (error) {
    return jsonShopError(error, "Could not generate a description.");
  }
}
