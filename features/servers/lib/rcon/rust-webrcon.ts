/**
 * Facepunch's own WebRcon protocol — open source
 * (github.com/Facepunch/webrcon), WebSocket-based, JSON messages.
 * Distinct from classic Source RCON (source-rcon.ts): Rust ships this as
 * a second, first-party RCON transport (`+rcon.web 1` on PC), and —
 * confirmed via GPORTAL's own official wiki, not inferred — it's also
 * the way to RCON into **Rust Console Edition** servers: "the rcon
 * client comes directly from facepunch." This is what actually closes
 * the console-Rust gap flagged when this file's sibling protocols were
 * first built — not a proprietary console-hosting-provider API, the
 * same official Facepunch protocol, just over WebSocket.
 *
 * Wire format (verified against a well-regarded open-source client
 * implementation, gorcon/websocket, cross-checked against the official
 * repo's stated field names):
 *   Connect: ws://{host}:{port}/{password} — the password IS the
 *     WebSocket URL path, not a separate auth message/handshake.
 *   Request:  {"Message": "<command>", "Identifier": <int>}
 *   Response: {"Message": "<output>", "Identifier": <int>,
 *              "Type": "<string>", "stacktrace": "<string>"}
 *   Match Identifier to correlate a response to its request.
 */

export class WebRconError extends Error {
  constructor(
    message: string,
    readonly kind: "TIMEOUT" | "AUTH_FAILED" | "CONNECTION_FAILED",
  ) {
    super(message);
    this.name = "WebRconError";
  }
}

type WebRconMessage = {
  Message: string;
  Identifier: number;
  Type?: string;
  stacktrace?: string;
};

/**
 * Opens a WebSocket connection, sends one command, waits for the
 * matching response, then closes. One-shot, matching the on-demand
 * polling model used throughout features/servers — not a kept-open
 * connection.
 */
export function buildWebRconUrl(host: string, port: number, password: string): string {
  return `ws://${host}:${port}/${encodeURIComponent(password)}`;
}

export async function runWebRconCommand(input: {
  host: string;
  port: number;
  password: string;
  command: string;
  timeoutMs?: number;
}): Promise<{ output: string }> {
  const timeoutMs = input.timeoutMs ?? 5000;
  const identifier = Math.floor(Math.random() * 1_000_000) + 1;
  const url = buildWebRconUrl(input.host, input.port, input.password);

  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocket(url);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(new WebRconError("WebRcon request timed out.", "TIMEOUT"));
    }, timeoutMs);

    function finish(fn: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      fn();
    }

    socket.addEventListener("error", () => {
      finish(() =>
        reject(new WebRconError("Could not open a WebRcon connection.", "CONNECTION_FAILED")),
      );
    });

    socket.addEventListener("open", () => {
      const request: WebRconMessage = { Message: input.command, Identifier: identifier };
      socket.send(JSON.stringify(request));
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      let parsed: WebRconMessage;
      try {
        parsed = JSON.parse(String(event.data)) as WebRconMessage;
      } catch {
        return; // ignore anything that isn't valid JSON, keep waiting
      }
      if (parsed.Identifier !== identifier) {
        return; // not our response (a server can push unrelated broadcasts)
      }
      finish(() => resolve({ output: parsed.Message }));
    });

    socket.addEventListener("close", (event: CloseEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // A close before any matching message usually means the password
      // (the URL path) was rejected.
      reject(new WebRconError(`WebRcon closed before responding (code ${event.code}).`, "AUTH_FAILED"));
    });
  });
}
