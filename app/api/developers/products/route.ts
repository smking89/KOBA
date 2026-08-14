import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonDeveloperError } from "@/features/developers/lib/http";
import { createDevProductSchema } from "@/features/developers/schemas/developer.schemas";
import { createProduct, listProducts } from "@/features/developers/services/developer.service";
import type { DevProductKind } from "@/features/developer-portal/lib/types";

export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind");
  const kind: DevProductKind | undefined =
    kindParam === "APPLICATION" || kindParam === "PLUGIN" ? kindParam : undefined;
  try {
    return NextResponse.json({
      items: await listProducts(kind, session?.user.id),
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not load developer products.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`dev-product:${session.user.id}`, 15, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many product create attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createDevProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product details." }, { status: 400 });
  }
  try {
    const product = await createProduct(session.user.id, parsed.data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return jsonDeveloperError(error, "Could not create product.");
  }
}
