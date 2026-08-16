import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { createDevProductSchema } from "@/features/developers/schemas/developer.schemas";
import { createProduct, listProducts } from "@/features/developers/services/developer.service";
import type { DevProductKind } from "@/features/developer-portal/lib/types";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind");
  const kind: DevProductKind | undefined =
    kindParam === "APPLICATION" || kindParam === "PLUGIN" ? kindParam : undefined;
  try {
    return jsonDeveloper({
      items: await listProducts(kind, session?.user.id),
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not load developer products.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonDeveloper({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`dev-product:${session.user.id}`, 15, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonDeveloper({ error: "Too many product create attempts." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonDeveloper({ error: "Invalid JSON body." }, 400);
  }
  const parsed = createDevProductSchema.safeParse(body);
  if (!parsed.success) {
    return jsonDeveloper({ error: "Invalid product details." }, 400);
  }
  try {
    const product = await createProduct(session.user.id, parsed.data);
    return jsonDeveloper(product, 201);
  } catch (error) {
    return jsonDeveloperError(error, "Could not create product.");
  }
}
