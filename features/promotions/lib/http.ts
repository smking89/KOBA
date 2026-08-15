import { NextResponse } from "next/server";
import { PromotionError, promotionErrorStatus } from "@/features/promotions/lib/errors";
import { InfluencerError, influencerErrorStatus } from "@/features/influencer/lib/errors";
import { WalletError, walletErrorStatus } from "@/features/wallet/lib/errors";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { staffMfaErrorResponse } from "@/features/staff-mfa/lib/http";

export const promotionNoStore = { "Cache-Control": "no-store" };

export function jsonPromotion(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: promotionNoStore });
}

export function jsonPromotionError(
  error: unknown,
  fallback = "Could not complete promotion action.",
) {
  const mfa = staffMfaErrorResponse(error);
  if (mfa) return mfa;
  if (error instanceof PromotionError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: promotionErrorStatus(error.code), headers: promotionNoStore },
    );
  }
  if (error instanceof InfluencerError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: influencerErrorStatus(error.code), headers: promotionNoStore },
    );
  }
  if (error instanceof WalletError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: walletErrorStatus(error.code), headers: promotionNoStore },
    );
  }
  if (error instanceof PaymentError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: paymentErrorStatus(error.code), headers: promotionNoStore },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: promotionNoStore });
}
