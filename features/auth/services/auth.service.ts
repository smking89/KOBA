import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AuditAction, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/dev-mailer";
import type { RegisterInput } from "@/features/auth/schemas/auth.schemas";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";

export class AuthServiceError extends Error {
  constructor(
    message: string,
    readonly code: "EMAIL_EXISTS" | "INVALID_TOKEN" | "TOKEN_EXPIRED" | "USER_NOT_FOUND",
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function registerUser(input: RegisterInput, ipAddress?: string | null) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw new AuthServiceError("An account with this email already exists.", "EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFICATION_TTL_MS);

  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.user.create({
      data: {
        email,
        name: input.name,
        passwordHash,
        profile: {
          create: {
            displayName: input.name,
          },
        },
      },
    });

    await tx.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.USER_REGISTERED,
    targetType: "User",
    targetId: user.id,
    ipAddress: ipAddress ?? null,
  });

  await sendVerificationEmail(email, token);

  return { userId: user.id };
}

export async function verifyEmail(email: string, token: string, ipAddress?: string | null) {
  const normalizedEmail = email.toLowerCase();
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: normalizedEmail, token },
  });

  if (!record) {
    throw new AuthServiceError("Invalid verification link.", "INVALID_TOKEN");
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail, token },
    });
    throw new AuthServiceError("Verification link has expired.", "TOKEN_EXPIRED");
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new AuthServiceError("Account not found.", "USER_NOT_FOUND");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail, token },
    }),
  ]);

  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.EMAIL_VERIFIED,
    targetType: "User",
    targetId: user.id,
    ipAddress: ipAddress ?? null,
  });
}

const RESET_PREFIX = "reset:";

export async function requestPasswordReset(email: string, ipAddress?: string | null) {
  const normalizedEmail = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return { sent: true };
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({
    where: { identifier: `${RESET_PREFIX}${normalizedEmail}` },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: `${RESET_PREFIX}${normalizedEmail}`,
      token,
      expires,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    targetType: "User",
    targetId: user.id,
    ipAddress: ipAddress ?? null,
  });

  const { sendPasswordResetEmail } = await import("@/lib/email/dev-mailer");
  await sendPasswordResetEmail(normalizedEmail, token);

  return { sent: true };
}

export async function resetPassword(
  email: string,
  token: string,
  password: string,
  ipAddress?: string | null,
) {
  const normalizedEmail = email.toLowerCase();
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: `${RESET_PREFIX}${normalizedEmail}`, token },
  });

  if (!record) {
    throw new AuthServiceError("Invalid reset link.", "INVALID_TOKEN");
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: `${RESET_PREFIX}${normalizedEmail}`, token },
    });
    throw new AuthServiceError("Reset link has expired.", "TOKEN_EXPIRED");
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new AuthServiceError("Account not found.", "USER_NOT_FOUND");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: `${RESET_PREFIX}${normalizedEmail}`, token },
    }),
  ]);

  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.PASSWORD_RESET_COMPLETED,
    targetType: "User",
    targetId: user.id,
    ipAddress: ipAddress ?? null,
  });
}
