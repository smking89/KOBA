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
      | "NOT_PAID",
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
      return 403;
    case "CONFLICT":
      return 409;
    case "NOT_CONFIGURED":
      return 503;
    case "INVALID_SIGNATURE":
      return 400;
    default:
      return 400;
  }
}
