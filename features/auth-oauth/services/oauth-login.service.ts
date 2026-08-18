import { AuditAction, type LoginOAuthProvider, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { allocateHandleCandidate, slugifyHandle } from "@/features/accounts/lib/handle";

export class OAuthLoginError extends Error {
  constructor(
    message: string,
    readonly code: "EMAIL_EXISTS" = "EMAIL_EXISTS",
  ) {
    super(message);
    this.name = "OAuthLoginError";
  }
}

type ProviderIdentity = {
  provider: LoginOAuthProvider;
  providerUserId: string;
  /** Real email when the provider gives one (Discord/Google). Steam has
   * no email; callers pass null and a synthetic placeholder is used. */
  email: string | null;
  /** Seeds the KOBA handle and display name for brand-new accounts. */
  displayName: string;
};

/** Finds the KOBA user a verified OAuth identity should log in as,
 * creating a brand-new account on first sign-in — but NEVER auto-linking
 * to an existing account by matching email (confirmed policy, 2026-08-17
 * via AskUserQuestion: "Block it, ask them to log in with password
 * first"). A provider identity that isn't already on file, whose email
 * belongs to an existing password account, is refused outright. */
export async function findOrCreateUserForOAuthLogin(identity: ProviderIdentity): Promise<string> {
  const existingIdentity = await prisma.userLoginIdentity.findUnique({
    where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.providerUserId } },
  });
  if (existingIdentity) {
    return existingIdentity.userId;
  }

  const email = identity.email?.toLowerCase() ?? syntheticEmail(identity.provider, identity.providerUserId);

  if (identity.email) {
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      throw new OAuthLoginError(
        "An account with this email already exists. Sign in with your password, then connect this account from Settings.",
      );
    }
  }

  let handle = slugifyHandle(identity.displayName);

  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const clash = await tx.accountProfile.findUnique({ where: { handle } });
      if (!clash) break;
      handle = allocateHandleCandidate(identity.displayName);
    }

    const created = await tx.user.create({
      data: {
        email,
        name: identity.displayName,
        // Real provider emails are treated as pre-verified (the provider
        // already proved control of the account); synthetic Steam
        // placeholders are left unverified since nobody can receive mail
        // there — same as an unverified credentials signup.
        emailVerified: identity.email ? new Date() : null,
        profile: {
          create: {
            handle,
            displayName: identity.displayName,
            activeAccountType: "PLAYER",
          },
        },
        loginIdentities: {
          create: {
            provider: identity.provider,
            providerUserId: identity.providerUserId,
          },
        },
      },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.USER_REGISTERED,
    targetType: "User",
    targetId: user.id,
    metadata: { via: `oauth:${identity.provider.toLowerCase()}` },
  });

  return user.id;
}

function syntheticEmail(provider: LoginOAuthProvider, providerUserId: string): string {
  return `${provider.toLowerCase()}-${providerUserId}@users.koba.games`;
}
