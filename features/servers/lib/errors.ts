export class ServerError extends Error {
  constructor(
    message: string,
    readonly code:
      "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID" | "UNSUPPORTED" | "UNAUTHORIZED_ROLE",
  ) {
    super(message);
    this.name = "ServerError";
  }
}

export function serverErrorStatus(code: ServerError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "UNAUTHORIZED_ROLE":
      return 403;
    case "CONFLICT":
      return 409;
    case "UNSUPPORTED":
    case "INVALID":
    default:
      return 400;
  }
}
