export class WalletError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "UNBALANCED"
      | "INSUFFICIENT"
      | "INVALID"
      | "NOT_IMPLEMENTED",
  ) {
    super(message);
    this.name = "WalletError";
  }
}

export function walletErrorStatus(code: WalletError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "NOT_IMPLEMENTED":
      return 501;
    case "UNBALANCED":
    case "INSUFFICIENT":
    case "INVALID":
    default:
      return 400;
  }
}
