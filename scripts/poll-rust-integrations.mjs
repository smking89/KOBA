/**
 * VPS cron entry for Phase 14E Rust integration polling.
 *
 * Usage:
 *   pnpm servers:integrations
 *   RUST_INTEGRATION_WORKER_LOOP=true pnpm servers:integrations
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

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { emitAlert, recordRconFailure } = await import("../lib/observability/alerts.ts");
const { runIntegrationBatch, integrationWorkerHealth } =
  await import("../features/servers/services/integration-worker.service.ts");

const health = integrationWorkerHealth();
if (!health.ok) {
  console.error("[poll-rust-integrations] encryption is not configured.");
  process.exit(1);
}

const intervalMs = Number.parseInt(process.env.RUST_INTEGRATION_WORKER_INTERVAL_MS ?? "60000", 10);

await runWorkerMain({
  name: "rcon-integration",
  loop: process.env.RUST_INTEGRATION_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 60_000,
  runOnce: async () => {
    const batch = await runIntegrationBatch({ concurrency: 4, limit: 20 });
    const failed = batch.failed;
    if (failed > 0 && recordRconFailure() >= 8) {
      await emitAlert("rcon_failure_spike", "RCON integration failures spiked", {
        labels: {
          worker: "rcon-integration",
          operation: "rcon_refresh",
          errorClass: "external_provider",
        },
      });
    }
    return {
      outcome: failed > 0 ? "failure" : "success",
      claimed: batch.selected,
      failed,
    };
  },
});
