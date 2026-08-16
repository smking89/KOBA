import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { ProductCommentError, productCommentErrorStatus } from "@/features/marketplace/lib/comment-errors";
import { postProductCommentSchema } from "@/features/marketplace/schemas/market.schemas";
import {
  listProductComments,
  postProductComment,
} from "@/features/marketplace/services/product-comment.service";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const comments = await listProductComments(slug);
    return NextResponse.json({ comments });
  } catch (error) {
    if (error instanceof ProductCommentError) {
      return NextResponse.json(
        { error: error.message },
        { status: productCommentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not load comments." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const limited = await rateLimit(`product-comment:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many comments. Slow down." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = postProductCommentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    const comment = await postProductComment(
      session.user.id,
      slug,
      parsed.data.body,
      clientIp(request),
    );
    return NextResponse.json(comment);
  } catch (error) {
    if (error instanceof ProductCommentError) {
      return NextResponse.json(
        { error: error.message },
        { status: productCommentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not post comment." }, { status: 500 });
  }
}
