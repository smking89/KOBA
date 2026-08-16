export type InfluencerErrorCode =
  | "UNAUTHORIZED_ROLE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "CONFLICT"
  | "NOT_ELIGIBLE"
  | "NOT_CONFIGURED"
  | "SELF_REFERRAL";

export class InfluencerError extends Error {
  readonly code: InfluencerErrorCode;

  constructor(message: string, code: InfluencerErrorCode) {
    super(message);
    this.name = "InfluencerError";
    this.code = code;
  }
}

export function influencerErrorStatus(code: InfluencerErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED_ROLE":
      return 401;
    case "FORBIDDEN":
    case "SELF_REFERRAL":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "NOT_CONFIGURED":
      return 503;
    default:
      return 400;
  }
}
