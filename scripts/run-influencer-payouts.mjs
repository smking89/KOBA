/**
 * VPS cron for Phase 14I influencer payout retries.
 *
 * Usage:
 *   pnpm influencer:payouts
 *
 * Pays ACCRUED/PAYABLE earnings when the influencer Connect account can receive transfers.
 * Never sends live-mode Stripe requests.
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

const { retryPayableInfluencerPayouts } =
  await import("../features/influencer/services/payout.service.ts");

const started = Date.now();
const results = await retryPayableInfluencerPayouts(25);
const paid = results.filter((row) => row?.status === "PAID").length;
console.info(
  `[influencer-payouts] checked=${results.length} paid=${paid} ms=${Date.now() - started}`,
);
