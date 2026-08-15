import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isLoginThrottled } from "@/features/auth/lib/login-throttle";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { CHALLENGE_PURPOSE } from "@/features/staff-mfa/lib/config";
import { StaffMfaError } from "@/features/staff-mfa/lib/errors";
import { createMfaChallenge } from "@/features/staff-mfa/services/staff-mfa.service";

export type LoginGateResult =
  { next: "session" } | { next: "enroll" } | { next: "mfa"; rawToken: string };

/**
 * Password gate used by the login form. Staff with active MFA do not receive
 * a session here — only a short-lived pending challenge.
 */
export async function startStaffAwareLogin(input: {
  email: string;
  password: string;
  ip: string;
}): Promise<LoginGateResult> {
  const email = input.email.toLowerCase();
  if (await isLoginThrottled(input.ip, email)) {
    throw new StaffMfaError("Invalid email or password.", "UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
      kobaIdentities: { select: { accountType: true } },
      staffMfaFactor: { select: { status: true } },
    },
  });

  if (!user?.passwordHash || !user.emailVerified) {
    throw new StaffMfaError("Invalid email or password.", "UNAUTHORIZED");
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new StaffMfaError("Invalid email or password.", "UNAUTHORIZED");
  }

  const isStaff = user.kobaIdentities.some((row) => isStaffAccountType(row.accountType));
  if (!isStaff) return { next: "session" };
  if (user.staffMfaFactor?.status === "ACTIVE") {
    const challenge = await createMfaChallenge({
      userId: user.id,
      purpose: CHALLENGE_PURPOSE.login,
      ip: input.ip,
    });
    return { next: "mfa", rawToken: challenge.rawToken };
  }
  return { next: "enroll" };
}
