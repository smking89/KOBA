import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { checkoutSchema } from "@/features/payments/schemas/checkout.schemas";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { createCheckoutSession } from "@/features/payments/services/checkout.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to check out." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = rateLimit(`checkout:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
  }

  try {
    const result = await createCheckoutSession(session.user.id, parsed.data, ip);
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
