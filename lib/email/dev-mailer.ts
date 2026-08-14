/** Prefer `@/lib/email/mailer`. */
export {
  sendVerificationEmail,
  sendPasswordResetEmail,
  buildVerificationUrl,
  buildPasswordResetUrl,
  isEmailConfigured,
} from "@/lib/email/mailer";
