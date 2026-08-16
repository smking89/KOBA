import { NextResponse } from "next/server";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { verifyStripeEvent } from "@/features/payments/lib/webhook-verify";
import { handleStripeEvent } from "@/features/payments/services/webhook.service";
import { emitAlert } from "@/lib/observability/alerts";
import { captureException } from "@/lib/observability/capture";
import { runWithObservabilityContext } from "@/lib/observability/context";
import { logger } from "@/lib/observability/logger";
import { resolveRequestId } from "@/lib/observability/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  return runWithObservabilityContext(
    { requestId, correlationId: requestId, route: "/api/stripe/webhook" },
    async () => {
      try {
        const event = verifyStripeEvent(rawBody, signature);
        logger.info("Stripe webhook accepted", {
          event: "stripe_webhook_received",
          operation: event.type,
          outcome: "success",
          extra: { stripeEventType: event.type },
        });
        await handleStripeEvent(event);
        return NextResponse.json({ received: true }, { headers: { "x-request-id": requestId } });
      } catch (error) {
        if (error instanceof PaymentError) {
          if (error.code === "INVALID_SIGNATURE") {
            await emitAlert("stripe_signature_rejected", "Stripe webhook signature rejected", {
              labels: { operation: "stripe_webhook", errorClass: "security_rejection" },
              error,
            });
          }
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: paymentErrorStatus(error.code), headers: { "x-request-id": requestId } },
          );
        }
        await emitAlert("stripe_webhook_failure", "Stripe webhook handler failed", {
          labels: { operation: "stripe_webhook", errorClass: "payment" },
          error,
        });
        await captureException(error, {
          route: "/api/stripe/webhook",
          operation: "handleStripeEvent",
        });
        return NextResponse.json(
          { error: "Webhook handler failed." },
          { status: 500, headers: { "x-request-id": requestId } },
        );
      }
    },
  );
}
