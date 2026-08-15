/**
 * VPS worker for Phase 14H developer webhook delivery.
 *
 * Queue: PostgreSQL DeveloperWebhookDelivery rows with optimistic `version` claims.
 *
 * Usage:
 *   pnpm developers:webhooks
 *   DEVELOPER_WEBHOOK_WORKER_LOOP=true pnpm developers:webhooks
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("[developer-webhooks] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { runWebhookBatch } = await import("../features/developers/services/webhook.service.ts");

const intervalMs = Number.parseInt(process.env.DEVELOPER_WEBHOOK_WORKER_INTERVAL_MS ?? "5000", 10);

await runWorkerMain({
  name: "developer-webhooks",
  loop: process.env.DEVELOPER_WEBHOOK_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 5000,
  runOnce: async () => {
    const batch = await runWebhookBatch(8);
    const failed = batch.results.filter((row) => row.status === "FAILED").length;
    return {
      outcome: failed > 0 ? "failure" : "success",
      claimed: batch.claimed,
      failed,
    };
  },
});
