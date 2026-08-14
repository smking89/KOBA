export class AidenError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "INSUFFICIENT" | "CONFLICT",
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
    case "INSUFFICIENT":
    case "INVALID":
    default:
      return 400;
  }
}
