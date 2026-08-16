import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { reviewSchema } from "@/features/developers/schemas/developer.schemas";
import {
  reportDeveloperProduct,
  upsertProductReview,
} from "@/features/developers/services/review.service";
import {
  limitDeveloper,
  readJsonBody,
  requireDeveloperSession,
} from "@/features/developers/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-review:${userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = reviewSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid review." }, 400);
  const { slug } = await context.params;
  try {
    return jsonDeveloper(await upsertProductReview(userId, slug, parsed.data));
  } catch (err) {
    return jsonDeveloperError(err, "Could not save review.");
  }
}

const reportSchema = z.object({ reason: z.string().trim().min(4).max(500) }).strict();

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = reportSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid report." }, 400);
  const { slug } = await context.params;
  try {
    return jsonDeveloper(await reportDeveloperProduct(userId, slug, parsed.data.reason), 201);
  } catch (err) {
    return jsonDeveloperError(err, "Could not report product.");
  }
}
