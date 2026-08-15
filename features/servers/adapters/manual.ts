import type { NormalizedStatusResult, ServerQueryAdapter } from "@/features/servers/adapters/types";
import { unsupportedResult } from "@/features/servers/adapters/types";
import { capabilitiesFor } from "@/features/servers/lib/capabilities";

/**
 * MANUAL / NOOP adapter — owner-reported metadata only.
 * Never opens network sockets.
 */
export const manualAdapter: ServerQueryAdapter = {
  key: "manual",
  supports() {
    return true;
  },
  capabilities(gameSlug, platformFamily) {
    return capabilitiesFor(gameSlug, platformFamily).filter(
      (c) => c !== "PUBLIC_QUERY" && c !== "RCON_READ" && c !== "RCON_WRITE",
    );
  },
  allowedPorts() {
    return [];
  },
  validateTarget() {
    // No network target required.
  },
  async queryStatus(): Promise<NormalizedStatusResult> {
    return unsupportedResult("manual", "MANUAL_ONLY");
  },
};
