export class DeveloperError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID"
      | "CONFLICT"
      | "INSUFFICIENT"
      | "NOT_CONFIGURED"
      | "RATE_LIMITED",
  ) {
    super(message);
    this.name = "DeveloperError";
  }
}

export function developerErrorStatus(code: DeveloperError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "CONFLICT":
      return 409;
    case "NOT_CONFIGURED":
      return 503;
    case "RATE_LIMITED":
      return 429;
    case "INSUFFICIENT":
    default:
      return 400;
  }
}
