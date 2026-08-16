export class ProductCommentError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "DISABLED",
  ) {
    super(message);
    this.name = "ProductCommentError";
  }
}

export function productCommentErrorStatus(code: ProductCommentError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "DISABLED":
      return 503;
    default:
      return 400;
  }
}
