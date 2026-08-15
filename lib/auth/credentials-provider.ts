import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/features/auth/schemas/auth.schemas";
import { isLoginThrottled } from "@/features/auth/lib/login-throttle";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { mintPublicKobaId } from "@/features/koba-id/services/mint.service";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { clientIp } from "@/lib/http/client-ip";

const mfaTicketSchema = z.object({
  mfaTicket: z.string().min(16).max(128),
});

async function sessionUserFromId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) return null;
  const accountType = user.profile?.activeAccountType ?? "PLAYER";
  if (!isStaffAccountType(accountType)) {
    await mintPublicKobaId(user.id, accountType);
  }
  const snapshot = await getAccountSnapshot(user.id);
  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.USER_LOGIN,
    targetType: "User",
    targetId: user.id,
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    kobaId: snapshot?.kobaId ?? null,
    accountType: snapshot?.activeAccountType ?? accountType,
    kobaIdRevealed: snapshot?.kobaIdRevealed ?? false,
  };
}

export const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
    mfaTicket: { label: "MFA ticket", type: "text" },
  },
  authorize: async (credentials, request) => {
    const ticketParsed = mfaTicketSchema.safeParse(credentials);
    if (ticketParsed.success) {
      const { consumeSessionTicket } =
        await import("@/features/staff-mfa/services/staff-mfa.service");
      const userId = await consumeSessionTicket(ticketParsed.data.mfaTicket);
      if (!userId) return null;
      return sessionUserFromId(userId);
    }

    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) {
      return null;
    }

    const email = parsed.data.email.toLowerCase();
    const ip = (request ? clientIp(request) : null) ?? "unknown";
    if (await isLoginThrottled(ip, email)) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        kobaIdentities: { select: { accountType: true } },
        staffMfaFactor: { select: { status: true } },
      },
    });

    if (!user?.passwordHash) {
      return null;
    }

    if (!user.emailVerified) {
      return null;
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return null;
    }

    const isStaff = user.kobaIdentities.some((row) => isStaffAccountType(row.accountType));
    // Staff with active MFA cannot obtain a JWT from password alone.
    if (isStaff && user.staffMfaFactor?.status === "ACTIVE") {
      return null;
    }

    return sessionUserFromId(user.id);
  },
});
