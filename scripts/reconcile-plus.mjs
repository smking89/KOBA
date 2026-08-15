/**
 * VPS cron entry for Phase 14F KOBA Plus reconciliation.
 *
 * Usage:
 *   pnpm plus:reconcile
 *   node scripts/reconcile-plus.mjs
 *
 * Fetches Stripe subscription state and updates local rows only.
 * Never writes local state back to Stripe.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("[reconcile-plus] DATABASE_URL is required.");
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  console.error("[reconcile-plus] Stripe test-mode secret is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { reconcileDuePlusSubscriptions } =
  await import("../features/plus/services/plus-reconcile.service.ts");

const started = Date.now();
const results = await reconcileDuePlusSubscriptions(25);
const drifted = results.filter((row) => !row.aligned).length;
console.info(
  `[reconcile-plus] checked=${results.length} drifted=${drifted} ms=${Date.now() - started}`,
);
