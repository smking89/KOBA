export class AidenError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID"
      | "INSUFFICIENT"
      | "CONFLICT"
      | "NOT_CONFIGURED"
      | "COST_OVERRUN",
  ) {
    super(message);
    this.name = "AidenError";
  }
}

export function aidenErrorStatus(code: AidenError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "CONFLICT":
      return 409;
    case "NOT_CONFIGURED":
      return 503;
    case "INSUFFICIENT":
    case "COST_OVERRUN":
    case "INVALID":
    default:
      return 400;
  }
}
