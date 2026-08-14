import { getPublicEnv } from "@/lib/env";

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const { appUrl } = getPublicEnv();
  const url = `${appUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (process.env.NODE_ENV !== "production") {
    console.info(`[KOBA] Email verification link for ${email}: ${url}`);
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const { appUrl } = getPublicEnv();
  const url = `${appUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (process.env.NODE_ENV !== "production") {
    console.info(`[KOBA] Password reset link for ${email}: ${url}`);
  }
}
