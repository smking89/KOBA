/**
 * VPS worker for Phase 14G Aiden generation.
 *
 * Queue: PostgreSQL AidenJob rows with optimistic `version` claims.
 * Redis/Upstash is used only for HTTP rate limits, not this queue.
 *
 * Usage:
 *   pnpm aiden:worker
 *   AIDEN_WORKER_LOOP=true pnpm aiden:worker
 *
 * Default is one batch (cron-friendly). Set AIDEN_WORKER_LOOP=true for a
 * long-running process with SIGINT/SIGTERM graceful shutdown.
 *
 * Does not call paid providers unless AIDEN_PROVIDER_API_KEY is configured
 * and a real adapter is implemented. This phase stays on the mock provider.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("[aiden-worker] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runAidenBatch, aidenWorkerHealth } =
  await import("../features/aiden/services/aiden-worker.service.ts");

const shuttingDown = { value: false };
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown.value = true;
  });
}

const loop = process.env.AIDEN_WORKER_LOOP === "true";
const intervalMs = Number.parseInt(process.env.AIDEN_WORKER_INTERVAL_MS ?? "5000", 10);
const waitMs = Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 5000;

async function runOnce() {
  const started = Date.now();
  const health = aidenWorkerHealth();
  const batch = await runAidenBatch({ concurrency: 2, limit: 8 });
  console.info(
    JSON.stringify({
      ok: true,
      elapsedMs: Date.now() - started,
      health,
      batch,
      at: new Date().toISOString(),
    }),
  );
}

if (shuttingDown.value) process.exit(0);
await runOnce();

while (loop && !shuttingDown.value) {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  if (shuttingDown.value) break;
  await runOnce();
}

process.exit(0);
