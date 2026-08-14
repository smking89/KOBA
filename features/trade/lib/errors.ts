export class TradeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID"
      | "RARITY_MISMATCH"
      | "SELF_TRADE",
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
      return 409;
    case "RARITY_MISMATCH":
    case "INVALID":
    default:
      return 400;
  }
}
