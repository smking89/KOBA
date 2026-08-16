import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAdminError } from "@/features/admin/lib/http";
import { listPendingDeveloperProducts } from "@/features/developers/services/moderation.service";
import { z } from "zod";
import { moderateDeveloperProduct } from "@/features/developers/services/moderation.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const products = await listPendingDeveloperProducts(session.user.id);
    return NextResponse.json(
      {
        products: products.map((product) => ({
          publicRef: product.publicRef,
          slug: product.slug,
          name: product.name,
          reviewState: product.reviewState,
          category: product.category,
          publisher: product.profile?.displayName ?? null,
          publisherSlug: product.profile?.slug ?? null,
          versions: product.versions.map((version) => ({
            publicRef: version.publicRef,
            semver: version.semver,
            reviewState: version.reviewState,
            artifacts: version.artifacts,
          })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonAdminError(error, "Could not load developer products.");
  }
}

const reviewSchema = z
  .object({
    publicRef: z.string().min(8),
    action: z.enum([
      "in_review",
      "request_changes",
      "approve",
      "publish",
      "reject",
      "suspend",
      "archive",
    ]),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const limited = await rateLimit(`admin-dev-product:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many review attempts." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review action." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await moderateDeveloperProduct(
      session.user.id,
      parsed.data.publicRef,
      parsed.data.action,
      parsed.data.reason,
      clientIp(request),
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonAdminError(error, "Could not moderate developer product.");
  }
}
