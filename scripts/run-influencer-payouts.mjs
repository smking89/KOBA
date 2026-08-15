/**
 * VPS cron for Phase 14I influencer payout retries.
 *
 * Usage:
 *   pnpm influencer:payouts
 *   INFLUENCER_PAYOUT_WORKER_LOOP=true pnpm influencer:payouts
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("[influencer-payouts] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { retryPayableInfluencerPayouts } =
  await import("../features/influencer/services/payout.service.ts");

const intervalMs = Number.parseInt(process.env.INFLUENCER_PAYOUT_WORKER_INTERVAL_MS ?? "15000", 10);

await runWorkerMain({
  name: "influencer-payouts",
  loop: process.env.INFLUENCER_PAYOUT_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 15_000,
  runOnce: async () => {
    const results = await retryPayableInfluencerPayouts(25);
    const failed = results.filter(
      (row) => row && row.status !== "PAID" && row.status !== "ACCRUED",
    ).length;
    return {
      outcome: failed > 0 ? "failure" : "success",
      claimed: results.length,
      failed,
    };
  },
});
