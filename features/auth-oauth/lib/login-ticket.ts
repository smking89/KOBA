import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/** One-time, short-lived ticket handing a verified OAuth identity off to
 * the Credentials provider (the only thing allowed to mint a NextAuth
 * session in this codebase) — mirrors StaffMfaChallenge's
 * session-issue ticket in features/staff-mfa/services/staff-mfa.service.ts,
 * kept as its own table since this isn't an MFA concern. */
const TICKET_TTL_MS = 2 * 60 * 1000;

function hashTicket(raw: string): string {
  return createHash("sha256").update(`koba:oauth-login-ticket:v1:${raw}`).digest("hex");
}

export async function issueLoginTicket(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.oAuthLoginTicket.create({
    data: {
      tokenHash: hashTicket(raw),
      userId,
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });
  return raw;
}

export async function consumeLoginTicket(rawTicket: string): Promise<string | null> {
  const row = await prisma.oAuthLoginTicket.findUnique({
    where: { tokenHash: hashTicket(rawTicket) },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const consumed = await prisma.oAuthLoginTicket.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return null;
  return row.userId;
}
