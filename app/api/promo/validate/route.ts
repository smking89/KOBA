import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { readJsonBody } from "@/features/promotions/lib/session";
import { validatePromoSchema } from "@/features/promotions/schemas/promotions.schemas";
import { validatePromoForProduct } from "@/features/promotions/services/promo-code.service";
import { prisma } from "@/lib/db";
import { promoGuessLimit } from "@/features/promotions/lib/tokens";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonPromotion({ error: "Unauthorized." }, 401);
  const limited = await rateLimit(
    `promo-guess:${session.user.id}`,
    promoGuessLimit(),
    15 * 60 * 1000,
  );
  if (!limited.success) return jsonPromotion({ error: "Too many attempts." }, 429);
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = validatePromoSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid promo." }, 400);
  try {
    const product = await prisma.product.findUnique({
      where: { slug: parsed.data.productSlug },
      select: { id: true, shopId: true, priceCents: true },
    });
    if (!product?.shopId) return jsonPromotion({ error: "Listing not found." }, 404);
    const snapshot = await getAccountSnapshot(session.user.id);
    const promo = await validatePromoForProduct({
      code: parsed.data.code,
      productId: product.id,
      shopId: product.shopId,
      buyerUserId: session.user.id,
      subtotalCents: product.priceCents * parsed.data.quantity,
      accountType: snapshot?.activeAccountType ?? "PLAYER",
    });
    return jsonPromotion({ promo });
  } catch (error) {
    return jsonPromotionError(error, "Promo code is not valid.");
  }
}
