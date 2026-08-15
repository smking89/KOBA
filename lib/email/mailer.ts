import { getPublicEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

export type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function buildVerificationUrl(email: string, token: string): string {
  const { appUrl } = getPublicEnv();
  return `${appUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

export function buildPasswordResetUrl(email: string, token: string): string {
  const { appUrl } = getPublicEnv();
  return `${appUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

async function sendViaResend(payload: MailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Resend is not configured (RESEND_API_KEY / EMAIL_FROM).");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend send failed (${response.status}): ${body.slice(0, 200)}`);
  }
}

async function deliver(payload: MailPayload): Promise<void> {
  const { nodeEnv } = getPublicEnv();

  if (isEmailConfigured()) {
    await sendViaResend(payload);
    return;
  }

  if (nodeEnv === "production") {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM before sending mail in production.",
    );
  }

  logger.info("Dev mail captured (body omitted)", {
    event: "email_dev_capture",
    operation: "email_deliver",
    outcome: "success",
    extra: { subject: payload.subject },
  });
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = buildVerificationUrl(email, token);
  await deliver({
    to: email,
    subject: "Verify your KOBA email",
    text: `Verify your KOBA account:\n${url}\n`,
    html: `<p>Verify your KOBA account:</p><p><a href="${url}">${url}</a></p>`,
  });
}

/**
 * Staff security notifications (Phase 15C). Best-effort by design: callers
 * must treat delivery failure as non-fatal so an already-applied security
 * action (revocation, reset) is never rolled back because email failed.
 */
export async function sendSecurityEmail(
  email: string,
  subject: string,
  lines: string[],
): Promise<void> {
  const text = `${lines.join("\n")}\n\nIf this was not you, secure your account immediately.\n`;
  await deliver({
    to: email,
    subject,
    text,
    html: `<p>${lines.map((line) => line.replace(/</g, "&lt;")).join("</p><p>")}</p><p>If this was not you, secure your account immediately.</p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = buildPasswordResetUrl(email, token);
  await deliver({
    to: email,
    subject: "Reset your KOBA password",
    text: `Reset your KOBA password:\n${url}\n`,
    html: `<p>Reset your KOBA password:</p><p><a href="${url}">${url}</a></p>`,
  });
}

/** Prefer importing from `@/lib/email/mailer`. */
