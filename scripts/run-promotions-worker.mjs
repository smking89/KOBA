/**
 * VPS cron for Phase 14I promotions: qualify commissions, settle ad reservations,
 * complete expired campaigns, and drop expired visitor hashes.
 *
 * Usage:
 *   pnpm promotions:worker
 *
 * Never sends live payouts or contacts Stripe.
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

const { runPromotionsWorker } = await import("../features/promotions/services/worker.service.ts");

const started = Date.now();
const result = await runPromotionsWorker(50);
console.info(
  `[promotions-worker] qualified=${result.qualified} adsSettled=${result.adsSettled} campaignsCompleted=${result.campaignsCompleted} hashesCleared=${result.hashesCleared} ms=${Date.now() - started}`,
);
