import { sendSecurityEmail } from "@/lib/email/mailer";
import { logger } from "@/lib/observability/logger";

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
    logger.error(
      "Staff security notification failed",
      {
        event: "email_delivery_failure",
        operation: "staff_security_mail",
        outcome: "failure",
      },
      error,
    );
  }
}
