import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { claimFreebie } from "@/features/payments/services/checkout.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to claim this freebie." }, { status: 401 });
  }

  const limited = await rateLimit(`claim-freebie:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many claim attempts." }, { status: 429 });
  }

  const { slug } = await context.params;

  try {
    const order = await claimFreebie(session.user.id, slug, clientIp(request));
    return NextResponse.json({ publicRef: order.publicRef, status: order.status });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not claim this freebie." }, { status: 500 });
  }
}
