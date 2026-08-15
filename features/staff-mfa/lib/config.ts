/** Staff MFA / privileged session policy (Phase 15C). */

export const STAFF_ELEVATION_COOKIE = "koba_staff_aal2";
export const STAFF_PENDING_COOKIE = "koba_staff_mfa_pending";

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Recent-MFA window for step-up on highly sensitive staff operations. */
export function stepUpWindowMs(): number {
  return positiveIntEnv("STAFF_STEPUP_WINDOW_MINUTES", 15) * 60 * 1000;
}

/** Staff elevation idle timeout. */
export function staffIdleTimeoutMs(): number {
  return positiveIntEnv("STAFF_SESSION_IDLE_MINUTES", 60) * 60 * 1000;
}

/** Staff elevation absolute lifetime (shorter than the 30-day public JWT). */
export function staffAbsoluteLifetimeMs(): number {
  return positiveIntEnv("STAFF_SESSION_ABSOLUTE_HOURS", 12) * 60 * 60 * 1000;
}

/** MFA-pending transactions expire quickly if abandoned. */
export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

/** One-time Auth.js session ticket issued only after a successful TOTP. */
export const MFA_TICKET_TTL_MS = 60 * 1000;

/** Abandoned enrollments expire; the pending secret becomes unusable. */
export const ENROLLMENT_TTL_MS = 15 * 60 * 1000;

export const RECOVERY_CODE_COUNT = 10;

export const CHALLENGE_PURPOSE = {
  login: "staff-login",
  reauth: "staff-reauth",
  sessionIssue: "session-issue",
} as const;

export type ChallengePurpose = (typeof CHALLENGE_PURPOSE)[keyof typeof CHALLENGE_PURPOSE];

/** Immediate enforcement: staff without MFA never receive AAL2. */
export function isStaffMfaEnforced(): boolean {
  const raw = process.env.STAFF_MFA_ENFORCE?.trim().toLowerCase();
  return raw !== "false" && raw !== "0";
}
