import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { subscriptionCheckoutSchema } from "@/features/payments/schemas/subscription-checkout.schemas";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { createSubscriptionCheckoutSession } from "@/features/payments/services/subscription-checkout.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
  }

  const limited = await rateLimit(`subscription-checkout:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = subscriptionCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
  }

  try {
    const result = await createSubscriptionCheckoutSession(session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
