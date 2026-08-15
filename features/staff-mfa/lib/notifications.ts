import { sendSecurityEmail } from "@/lib/email/mailer";

/**
 * Best-effort staff security mail. Delivery failure is logged and swallowed
 * so an already-applied revocation or reset is never rolled back.
 */
export async function notifyStaffSecurity(
  email: string | null | undefined,
  subject: string,
  lines: string[],
): Promise<void> {
  if (!email) return;
  try {
    await sendSecurityEmail(email, subject, lines);
  } catch (error) {
    console.error("[staff-mfa] security notification failed", error);
  }
}
