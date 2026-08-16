/**
 * VPS cron for Phase 14I promotions: qualify commissions, settle ad reservations,
 * complete expired campaigns, and drop expired visitor hashes.
 *
 * Usage:
 *   pnpm promotions:worker
 *   PROMOTIONS_WORKER_LOOP=true pnpm promotions:worker
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("[promotions-worker] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { runPromotionsWorker } = await import("../features/promotions/services/worker.service.ts");

const intervalMs = Number.parseInt(process.env.PROMOTIONS_WORKER_INTERVAL_MS ?? "15000", 10);

await runWorkerMain({
  name: "promotions",
  loop: process.env.PROMOTIONS_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 15_000,
  runOnce: async () => {
    const result = await runPromotionsWorker(50);
    return {
      outcome: "success",
      claimed:
        result.qualified + result.adsSettled + result.campaignsCompleted + result.hashesCleared,
    };
  },
});
