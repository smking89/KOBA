import { createHash, randomBytes } from "node:crypto";
import {
  staffAbsoluteLifetimeMs,
  staffIdleTimeoutMs,
  stepUpWindowMs,
} from "@/features/staff-mfa/lib/config";

/**
 * Pure staff-elevation policy (Phase 15C) — separated from I/O so idle,
 * absolute, revocation, and step-up rules are deterministic under test.
 */

export type StaffSessionRow = {
  id: string;
  userId: string;
  createdAt: Date;
  lastSeenAt: Date;
  lastMfaAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type ElevationAssessment =
  | { ok: true; stepUpFresh: boolean }
  | { ok: false; reason: "revoked" | "absolute-expired" | "idle-expired" };

export function assessStaffSession(
  row: StaffSessionRow,
  nowMs: number,
  overrides?: { idleMs?: number; stepUpMs?: number },
): ElevationAssessment {
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (nowMs >= row.expiresAt.getTime()) return { ok: false, reason: "absolute-expired" };
  const idleMs = overrides?.idleMs ?? staffIdleTimeoutMs();
  if (nowMs - row.lastSeenAt.getTime() >= idleMs) return { ok: false, reason: "idle-expired" };
  const stepUpMs = overrides?.stepUpMs ?? stepUpWindowMs();
  return { ok: true, stepUpFresh: nowMs - row.lastMfaAt.getTime() < stepUpMs };
}

export function newElevationToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashElevationToken(raw) };
}

export function hashElevationToken(raw: string): string {
  return createHash("sha256").update(`koba:staff-elevation:v1:${raw}`).digest("hex");
}

/** MFA-pending / session-issue tokens — different purpose prefix so they cannot be swapped. */
export function hashChallengeToken(raw: string): string {
  return createHash("sha256").update(`koba:staff-mfa-challenge:v1:${raw}`).digest("hex");
}

export function newChallengeToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashChallengeToken(raw) };
}

export function elevationExpiry(nowMs: number): Date {
  return new Date(nowMs + staffAbsoluteLifetimeMs());
}

/** Privacy: sessions dashboard never sees raw IPs, only a salted hash prefix. */
export function hashIpForPrivacy(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`koba:ip:v1:${ip}`).digest("hex");
}

/** Sanitized, truncated user agent for display. */
export function sanitizeUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return userAgent.replace(/[^\x20-\x7e]/g, "").slice(0, 160) || null;
}
