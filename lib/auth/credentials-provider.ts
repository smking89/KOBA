import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/features/auth/schemas/auth.schemas";
import { isLoginThrottled } from "@/features/auth/lib/login-throttle";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { mintPublicKobaId } from "@/features/koba-id/services/mint.service";
import { clientIp } from "@/lib/http/client-ip";

export const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials, request) => {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) {
      return null;
    }

    const email = parsed.data.email.toLowerCase();

    // KOBA-SEC-005: throttle before touching the database. Returning null on
    // throttle produces the same generic error as bad credentials, so the
    // limiter cannot be used to enumerate accounts.
    const ip = (request ? clientIp(request) : null) ?? "unknown";
    if (await isLoginThrottled(ip, email)) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
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

    const accountType = user.profile?.activeAccountType ?? "PLAYER";
    await mintPublicKobaId(user.id, accountType);
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
  },
});
