import { isRealAidenProviderConfigured } from "@/features/aiden/lib/provider";
import { malwareScanningActive } from "@/features/aiden/lib/malware-scan";
import { aidenProviderId } from "@/features/aiden/lib/pricing";

export const AIDEN_WORKER_CONCURRENCY = 2;
export const AIDEN_WORKER_BATCH = 8;

export function aidenWorkerHealth() {
  return {
    ok: true,
    service: "koba-aiden-worker",
    provider: aidenProviderId(),
    realProviderConfigured: isRealAidenProviderConfigured(),
    malwareScanning: malwareScanningActive(),
    queue: "postgres" as const,
    time: new Date().toISOString(),
  };
}
