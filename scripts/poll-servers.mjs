/**
 * VPS cron entry for Phase 14D status polling.
 *
 * Usage:
 *   pnpm servers:poll
 *   node scripts/poll-servers.mjs
 *
 * Requires DATABASE_URL (and SECRET_ENCRYPTION_KEY if your app env does).
 * Never invoke from Next.js page render — this is a worker-only entrypoint.
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

const { runPollBatch, retainSnapshots } =
  await import("../features/servers/services/polling.service.ts");

const started = Date.now();
const batch = await runPollBatch({ concurrency: 4, limit: 40 });
const retention = await retainSnapshots();

console.log(
  JSON.stringify(
    {
      ok: true,
      elapsedMs: Date.now() - started,
      batch: {
        selected: batch.selected,
        succeeded: batch.succeeded,
        failed: batch.failed,
      },
      retention,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);

process.exit(0);
