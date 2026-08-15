/** Same "is this a placeholder, not a real credential" check as
 * features/payments/lib/stripe.ts#isStripeConfigured — kept as its own
 * small shared helper since three providers need it identically. */
export function isPlaceholderCredential(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  return value.includes("replace") || value.endsWith("_me");
}

export function isEnvConfigured(envVar: string): boolean {
  return !isPlaceholderCredential(process.env[envVar]);
}
