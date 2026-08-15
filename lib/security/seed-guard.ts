/**
 * Seed safety guard (KOBA-SEC-001).
 *
 * The seed script creates development fixtures, including a local staff
 * account. Running it against a production database would plant known
 * credentials, so it fails closed with no override.
 */
export function assertSeedAllowed(env: { NODE_ENV?: string | undefined } = process.env): void {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed: NODE_ENV=production. The seed script writes development fixtures " +
        "(including a local staff login) and must never run against production data.",
    );
  }
}
