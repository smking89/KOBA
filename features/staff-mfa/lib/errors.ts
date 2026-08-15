export type StaffMfaErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "MFA_ENROLLMENT_REQUIRED"
  | "MFA_REQUIRED"
  | "STEP_UP_REQUIRED"
  | "INVALID"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED";

export class StaffMfaError extends Error {
  constructor(
    message: string,
    readonly code: StaffMfaErrorCode,
  ) {
    super(message);
    this.name = "StaffMfaError";
  }
}

export function staffMfaErrorStatus(code: StaffMfaErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "MFA_ENROLLMENT_REQUIRED":
    case "MFA_REQUIRED":
    case "STEP_UP_REQUIRED":
      return 403;
    case "RATE_LIMITED":
      return 429;
    case "NOT_CONFIGURED":
      return 503;
    default:
      return 400;
  }
}
