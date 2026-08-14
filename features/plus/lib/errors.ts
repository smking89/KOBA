export class PlusError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT",
  ) {
    super(message);
    this.name = "PlusError";
  }
}

export function plusErrorStatus(code: PlusError["code"]): number {
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
