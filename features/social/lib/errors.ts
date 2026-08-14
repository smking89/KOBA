export class SocialError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "BLOCKED" | "CONFLICT" | "INVALID" | "TAG_DENIED",
  ) {
    super(message);
    this.name = "SocialError";
  }
}

export function socialErrorStatus(code: SocialError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "BLOCKED":
    case "TAG_DENIED":
      return 403;
    case "CONFLICT":
      return 409;
    default:
      return 400;
  }
}
