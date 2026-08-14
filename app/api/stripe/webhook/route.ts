import { NextResponse } from "next/server";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { verifyStripeEvent } from "@/features/payments/lib/webhook-verify";
import { handleStripeEvent } from "@/features/payments/services/webhook.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const event = verifyStripeEvent(rawBody, signature);
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
