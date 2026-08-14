export class MessageError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "BLOCKED" | "CONFLICT" | "INVALID",
  ) {
    super(message);
    this.name = "MessageError";
  }
}

export function messageErrorStatus(code: MessageError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "BLOCKED":
      return 403;
    case "CONFLICT":
      return 409;
    default:
      return 400;
  }
}
