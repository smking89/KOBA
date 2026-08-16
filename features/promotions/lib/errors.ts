export class PromotionError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "PromotionError";
    this.code = code;
  }
}

export function promotionErrorStatus(code: string): number {
  switch (code) {
    case "UNAUTHORIZED_ROLE":
      return 401;
    case "FORBIDDEN":
    case "SELF_REFERRAL":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "INSUFFICIENT":
      return 402;
    default:
      return 400;
  }
}
