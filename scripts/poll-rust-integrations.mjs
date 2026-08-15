/**
 * VPS cron entry for Phase 14E Rust integration polling.
 *
 * Usage:
 *   pnpm servers:integrations
 *   node scripts/poll-rust-integrations.mjs
 *
 * Requires DATABASE_URL and KOBA_CREDENTIAL_ENCRYPTION_KEY.
 * Never invoke from Next.js page render — this is a worker-only entrypoint.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("[poll-rust-integrations] DATABASE_URL is required.");
  process.exit(1);
}

if (!process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY) {
  console.error("[poll-rust-integrations] KOBA_CREDENTIAL_ENCRYPTION_KEY is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runIntegrationBatch, integrationWorkerHealth } =
  await import("../features/servers/services/integration-worker.service.ts");

const started = Date.now();
const health = integrationWorkerHealth();
if (!health.ok) {
  console.error("[poll-rust-integrations] encryption is not configured.");
  process.exit(1);
}

const batch = await runIntegrationBatch({ concurrency: 4, limit: 20 });

console.log(
  JSON.stringify(
    {
      ok: true,
      elapsedMs: Date.now() - started,
      health,
      batch,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);

process.exit(0);
