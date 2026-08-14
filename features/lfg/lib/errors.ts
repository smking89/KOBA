export class LfgError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "SELF_JOIN" | "CLOSED" | "CONFLICT" | "INVALID",
  ) {
    super(message);
    this.name = "LfgError";
  }
}

export function lfgErrorStatus(code: LfgError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "SELF_JOIN":
      return 403;
    case "CONFLICT":
      return 409;
    default:
      return 400;
  }
}
