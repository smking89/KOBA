export class KobaShopError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "NOT_APPROVED"
      | "NOT_LIVE"
      | "SELLER_NOT_READY"
      | "NOT_CONFIGURED"
      | "AMOUNT_TOO_LARGE"
      | "ALREADY_OWNED"
      | "NOT_OWNED"
      | "REQUIRES_PLUS",
  ) {
    super(message);
    this.name = "KobaShopError";
  }
}

export function kobaShopErrorStatus(code: KobaShopError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "REQUIRES_PLUS":
      return 403;
    case "CONFLICT":
    case "ALREADY_OWNED":
      return 409;
    case "NOT_CONFIGURED":
      return 503;
    default:
      return 400;
  }
}
