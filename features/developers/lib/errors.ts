export class DeveloperError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT",
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
    default:
      return 400;
  }
}
