import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { placeBidSchema } from "@/features/auctions/schemas/auction.schemas";
import { AuctionError, placeBid } from "@/features/auctions/services/auction.service";

function statusFor(code: AuctionError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "SELF_BID":
    case "FORBIDDEN":
      return 403;
    case "CONFLICT":
      return 409;
    case "TOO_LOW":
    case "NOT_LIVE":
    case "ENDED":
      return 400;
    default:
      return 400;
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to place a bid." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = rateLimit(`bid:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many bids. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = placeBidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bid." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    const auction = await placeBid(session.user.id, slug, parsed.data, ip);
    return NextResponse.json(auction);
  } catch (error) {
    if (error instanceof AuctionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusFor(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not place bid." }, { status: 500 });
  }
}
