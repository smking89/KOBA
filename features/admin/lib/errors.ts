export class AdminError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID",
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export function adminErrorStatus(code: AdminError["code"]): number {
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
