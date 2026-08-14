export class GroupError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "BANNED" | "ALREADY_MEMBER" | "CONFLICT" | "INVALID",
  ) {
    super(message);
    this.name = "GroupError";
  }
}

export function groupErrorStatus(code: GroupError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "BANNED":
      return 403;
    case "ALREADY_MEMBER":
    case "CONFLICT":
      return 409;
    default:
      return 400;
  }
}
