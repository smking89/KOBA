export class KobaIdError extends Error {
  constructor(
    message: string,
    readonly code:
      | "STAFF_NOT_PUBLIC"
      | "PUBLIC_NOT_STAFF"
      | "ALREADY_EXISTS"
      | "COLLISION"
      | "FORBIDDEN"
      | "USER_NOT_FOUND"
      | "IDENTITY_MISSING",
  ) {
    super(message);
    this.name = "KobaIdError";
  }
}
