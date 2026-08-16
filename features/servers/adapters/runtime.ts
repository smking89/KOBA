import { createMinecraftJavaAdapter } from "@/features/servers/adapters/minecraft-java";
import { createRustAdapter } from "@/features/servers/adapters/rust";
import { createNativeWebRconTransport } from "@/features/servers/adapters/rust-webrcon";
import { getAdapter } from "@/features/servers/adapters/registry";
import type { ServerQueryAdapter } from "@/features/servers/adapters/types";
import { createUdpTransport } from "@/features/servers/lib/udp-transport";

/**
 * Adapters with real sockets — VPS workers only.
 * Page render and the default registry stay transport-free for tests.
 */
export function getRuntimeAdapter(key: string): ServerQueryAdapter {
  if (key === "rust") {
    return createRustAdapter({
      a2sTransport: createUdpTransport(),
      webrconTransport: createNativeWebRconTransport(),
    });
  }
  if (key === "minecraft-java") {
    return createMinecraftJavaAdapter(createUdpTransport());
  }
  return getAdapter(key);
}
