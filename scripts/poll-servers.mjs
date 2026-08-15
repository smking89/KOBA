/**
 * VPS cron entry for Phase 14D status polling.
 *
 * Usage:
 *   pnpm servers:poll
 *   SERVER_POLL_WORKER_LOOP=true pnpm servers:poll
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("[poll-servers] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { runPollBatch, retainSnapshots } =
  await import("../features/servers/services/polling.service.ts");

const intervalMs = Number.parseInt(process.env.SERVER_POLL_WORKER_INTERVAL_MS ?? "60000", 10);

await runWorkerMain({
  name: "server-poll",
  loop: process.env.SERVER_POLL_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 60_000,
  runOnce: async () => {
    const batch = await runPollBatch({ concurrency: 4, limit: 40 });
    await retainSnapshots();
    return {
      outcome: batch.failed > 0 ? "failure" : "success",
      claimed: batch.selected,
      failed: batch.failed,
    };
  },
});
