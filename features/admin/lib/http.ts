import { NextResponse } from "next/server";
import { AdminError, adminErrorStatus } from "@/features/admin/lib/errors";
import { ShopError } from "@/features/shops/services/shop.service";
import { SocialError, socialErrorStatus } from "@/features/social/lib/errors";
import { KobaIdError } from "@/features/koba-id/services/koba-id-error";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { DeveloperError, developerErrorStatus } from "@/features/developers/lib/errors";
import { WalletError, walletErrorStatus } from "@/features/wallet/lib/errors";

export function jsonAdminError(error: unknown, fallback = "Could not complete staff action.") {
  if (error instanceof AdminError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: adminErrorStatus(error.code) },
    );
  }
  if (error instanceof ShopError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "ALREADY_EXISTS"
            ? 409
            : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof SocialError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: socialErrorStatus(error.code) },
    );
  }
  if (error instanceof KobaIdError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code === "ALREADY_EXISTS"
          ? 409
          : error.code === "USER_NOT_FOUND"
            ? 404
            : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof PaymentError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: paymentErrorStatus(error.code) },
    );
  }
  if (error instanceof DeveloperError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: developerErrorStatus(error.code) },
    );
  }
  if (error instanceof WalletError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: walletErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
