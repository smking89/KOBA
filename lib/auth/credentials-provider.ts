import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/features/auth/schemas/auth.schemas";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { mintPublicKobaId } from "@/features/koba-id/services/mint.service";

export const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials) => {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) {
      return null;
    }

    const email = parsed.data.email.toLowerCase();
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
