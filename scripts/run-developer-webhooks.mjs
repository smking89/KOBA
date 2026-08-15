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

const { runWebhookBatch } = await import("../features/developers/services/webhook.service.ts");

const shuttingDown = { value: false };
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown.value = true;
  });
}

const loop = process.env.DEVELOPER_WEBHOOK_WORKER_LOOP === "true";
const intervalMs = Number.parseInt(process.env.DEVELOPER_WEBHOOK_WORKER_INTERVAL_MS ?? "5000", 10);
const waitMs = Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 5000;

async function runOnce() {
  const started = Date.now();
  const batch = await runWebhookBatch(8);
  console.info(
    JSON.stringify({
      ok: true,
      elapsedMs: Date.now() - started,
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
