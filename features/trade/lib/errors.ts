export class TradeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID"
      | "RARITY_MISMATCH"
      | "SELF_TRADE"
      | "LOCKED"
      | "EXPIRED"
      | "INSUFFICIENT",
  ) {
    super(message);
    this.name = "TradeError";
  }
}

export function tradeErrorStatus(code: TradeError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "CONFLICT":
    case "SELF_TRADE":
    case "LOCKED":
    case "EXPIRED":
      return 409;
    case "INSUFFICIENT":
    case "RARITY_MISMATCH":
    case "INVALID":
    default:
      return 400;
  }
}
