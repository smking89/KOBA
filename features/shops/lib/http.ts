import { NextResponse } from "next/server";
import { ShopError } from "@/features/shops/services/shop.service";

export function shopErrorStatus(code: ShopError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "ALREADY_EXISTS":
      return 409;
    case "FORBIDDEN":
    case "SELF_ACTION":
    case "UNVERIFIED_BUSINESS":
      return 403;
    case "INVALID_PAYOUT_VALUE":
      return 400;
    case "GENERATION_FAILED":
      return 502;
    case "DISABLED":
      return 503;
    default:
      return 400;
  }
}

export function jsonShopError(error: unknown, fallback = "Could not complete shop action.") {
  if (error instanceof ShopError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: shopErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
