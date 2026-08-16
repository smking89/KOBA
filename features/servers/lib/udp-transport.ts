import { createSocket } from "node:dgram";
import type { A2sTransport } from "@/features/servers/adapters/rust-a2s";
import { revalidateResolvedIp } from "@/features/servers/lib/ssrf";

/** Worker-only UDP transport. Never import from RSC/page render. */
export function createUdpTransport(): A2sTransport {
  return ({ ip, port, packet, timeoutMs, maxResponseBytes }) => {
    revalidateResolvedIp(ip);
    return new Promise((resolve, reject) => {
      const socket = createSocket(ip.includes(":") ? "udp6" : "udp4");
      let settled = false;
      const finish = (error?: Error, value?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.removeAllListeners();
        try {
          socket.close();
        } catch {
          /* already closed */
        }
        if (error) reject(error);
        else resolve(value ?? Buffer.alloc(0));
      };

      const timer = setTimeout(() => finish(new Error("TIMEOUT")), timeoutMs);
      socket.once("error", (error) => finish(error));
      socket.once("message", (msg) => {
        if (msg.byteLength > maxResponseBytes) {
          finish(new Error("RESPONSE_TOO_LARGE"));
          return;
        }
        finish(undefined, msg);
      });
      socket.send(packet, port, ip, (error) => {
        if (error) finish(error);
      });
    });
  };
}
