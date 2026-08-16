/**
 * VPS cron entry for Phase 14F KOBA Plus reconciliation.
 *
 * Usage:
 *   pnpm plus:reconcile
 *   PLUS_RECONCILE_WORKER_LOOP=true pnpm plus:reconcile
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

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { emitAlert } = await import("../lib/observability/alerts.ts");
const { reconcileDuePlusSubscriptions } =
  await import("../features/plus/services/plus-reconcile.service.ts");

const intervalMs = Number.parseInt(process.env.PLUS_RECONCILE_WORKER_INTERVAL_MS ?? "300000", 10);

await runWorkerMain({
  name: "plus-reconcile",
  loop: process.env.PLUS_RECONCILE_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 300_000,
  runOnce: async () => {
    const results = await reconcileDuePlusSubscriptions(25);
    const drifted = results.filter((row) => !row.aligned).length;
    if (drifted > 0) {
      await emitAlert(
        "payment_reconciliation_mismatch",
        "Plus subscription state drifted from Stripe",
        {
          labels: { worker: "plus-reconcile", operation: "plus_reconcile", errorClass: "payment" },
          extra: { driftedCount: drifted, checked: results.length },
        },
      );
    }
    return {
      outcome: drifted > 0 ? "failure" : "success",
      claimed: results.length,
      failed: drifted,
    };
  },
});
