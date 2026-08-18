export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_CONFIGURED"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "SELF_BUY"
      | "NOT_LIVE"
      | "SOLD_OUT"
      | "SELLER_NOT_READY"
      | "AUCTION_LOCKED"
      | "CONFLICT"
      | "INVALID_SIGNATURE"
      | "NOT_PAID"
      | "INVALID"
      | "AMOUNT_TOO_LARGE"
      | "DISABLED"
      | "NOT_FREEBIE"
      | "BLACKLISTED"
      | "REQUIRES_GAME_IDENTITY",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export function paymentErrorStatus(code: PaymentError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "SELF_BUY":
    case "BLACKLISTED":
    case "REQUIRES_GAME_IDENTITY":
      return 403;
    case "CONFLICT":
      return 409;
    case "NOT_CONFIGURED":
    case "DISABLED":
      return 503;
    case "INVALID_SIGNATURE":
      return 400;
    default:
      return 400;
  }
}
