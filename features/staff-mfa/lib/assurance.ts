import { cookies } from "next/headers";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { StaffMfaError } from "@/features/staff-mfa/lib/errors";
import { STAFF_ELEVATION_COOKIE, isStaffMfaEnforced } from "@/features/staff-mfa/lib/config";
import { loadStaffTypes, userHasActiveStaffMfa } from "@/features/staff-mfa/lib/staff-user";
import {
  getActiveElevation,
  type ActiveElevation,
} from "@/features/staff-mfa/services/staff-session.service";

export type StaffAssurance = {
  types: string[];
  elevation: ActiveElevation;
};

export async function readElevationCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(STAFF_ELEVATION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export function enrollmentPath(): string {
  return "/settings/security/mfa";
}

export function challengePath(callbackUrl = "/admin"): string {
  return `/login/mfa?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Server-side AAL2 gate. Never trusts JWT accountType or client-supplied IDs.
 * Staff identity is loaded from the database; elevation is a hashed cookie.
 */
export async function assertStaffAal2(
  userId: string,
  opts?: { stepUp?: boolean; rawToken?: string | null; nowMs?: number },
): Promise<StaffAssurance> {
  const types = await loadStaffTypes(userId);
  if (!types.some((type) => isStaffAccountType(type))) {
    throw new StaffMfaError("Staff only.", "FORBIDDEN");
  }

  if (isStaffMfaEnforced()) {
    const enrolled = await userHasActiveStaffMfa(userId);
    if (!enrolled) {
      throw new StaffMfaError("Staff MFA enrollment is required.", "MFA_ENROLLMENT_REQUIRED");
    }
  }

  const rawToken = opts?.rawToken !== undefined ? opts.rawToken : await readElevationCookie();
  if (!rawToken) {
    throw new StaffMfaError("Staff multi-factor authentication is required.", "MFA_REQUIRED");
  }

  const elevation = await getActiveElevation(userId, rawToken, opts?.nowMs ?? Date.now());
  if (!elevation) {
    throw new StaffMfaError("Staff multi-factor authentication is required.", "MFA_REQUIRED");
  }

  if (opts?.stepUp && !elevation.stepUpFresh) {
    throw new StaffMfaError("Recent multi-factor verification is required.", "STEP_UP_REQUIRED");
  }

  return { types, elevation };
}
