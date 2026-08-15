import { NextResponse } from "next/server";
import { InfluencerError, influencerErrorStatus } from "@/features/influencer/lib/errors";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export const influencerNoStore = { "Cache-Control": "no-store" };

export function jsonInfluencer(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: influencerNoStore });
}

export function jsonInfluencerError(
  error: unknown,
  fallback = "Could not complete influencer action.",
) {
  if (error instanceof InfluencerError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: influencerErrorStatus(error.code), headers: influencerNoStore },
    );
  }
  if (error instanceof PaymentError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: paymentErrorStatus(error.code), headers: influencerNoStore },
    );
  }
  return unexpectedJsonError(error, fallback, influencerNoStore);
}
