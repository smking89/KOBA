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
      reject(
        new WebRconError(`WebRcon closed before responding (code ${event.code}).`, "AUTH_FAILED"),
      );
    });
  });
}

export type RustStatusInfo = {
  hostname: string | null;
  mapName: string | null;
  players: number | null;
  maxPlayers: number | null;
  queued: number | null;
};

/**
 * Parses Rust's `status` console command text output. This is the path
 * to live stats on Rust Console Edition — A2S_INFO (source-query.ts) is
 * very unlikely to be reachable there (nothing suggests a UDP query
 * port survives Xbox Live/PSN networking the way it does on PC), but
 * `status` is a normal RCON command, and WebRcon already reaches
 * Console Edition — no separate protocol needed.
 *
 * CONFIDENCE NOTE (lower than source-rcon.ts/source-query.ts's wire
 * formats, be honest about it): every source checked agrees on *which
 * fields* `status` reports (hostname, map, player counts, a queued
 * count), but none gave a guaranteed-current, byte-exact example to
 * verify a parser against the way A2S_INFO's format was verified
 * against a real client library. This parser targets the widely-
 * documented, long-standing shape:
 *   hostname: <name>
 *   ...
 *   map     : <name>
 *   players : <n> (<max> max) (<q> queued) ...
 * and is deliberately defensive: any line it doesn't recognize is
 * skipped, not guessed at, and a field stays null rather than being
 * populated with a wrong parse. Verify against a real server's output
 * before relying on this for anything beyond a best-effort display.
 */
export function parseStatusOutput(output: string): RustStatusInfo {
  const hostnameMatch = /^\s*hostname\s*:\s*(.+)$/im.exec(output);
  const mapMatch = /^\s*map\s*:\s*(.+)$/im.exec(output);
  const playersMatch = /^\s*players\s*:\s*(\d+)\s*\((\d+)\s*max\)(?:\s*\((\d+)\s*queued\))?/im.exec(
    output,
  );

  const hostname = hostnameMatch?.[1];
  const mapName = mapMatch?.[1];
  const playersRaw = playersMatch?.[1];
  const maxPlayersRaw = playersMatch?.[2];
  const queuedRaw = playersMatch?.[3];

  return {
    hostname: hostname ? hostname.trim() : null,
    mapName: mapName ? mapName.trim() : null,
    players: playersRaw ? Number.parseInt(playersRaw, 10) : null,
    maxPlayers: maxPlayersRaw ? Number.parseInt(maxPlayersRaw, 10) : null,
    queued: queuedRaw ? Number.parseInt(queuedRaw, 10) : null,
  };
}

type RustPlayerListEntry = { SteamID: string; DisplayName: string; Ping: number };

/**
 * `playerlist` — a real, structured JSON array (verified against a
 * concrete published example: SteamID/DisplayName/Ping/Address/etc. per
 * player), not freeform text. Strictly higher confidence than
 * `status`'s regex-parsed player count, since there's no text format to
 * guess at — it either parses as a JSON array or it doesn't. This is
 * why the count in RustStatusInfo below prefers this over `status`'s
 * count when both succeed.
 */
export function parsePlayerListOutput(raw: string): number | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RustPlayerListEntry[]).length : null;
  } catch {
    return null;
  }
}

async function queryRustPlayerList(input: {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
}): Promise<number | null> {
  const result = await runWebRconCommand({ ...input, command: "playerlist" });
  return parsePlayerListOutput(result.output);
}

/**
 * Combines `playerlist` (JSON, high confidence, player count only) with
 * `status` (text, lower confidence, the only source for hostname/map/
 * max-players) — the live-stats path for any Rust server reachable via
 * WebRcon, Console Edition included. Runs both; a failure in one
 * doesn't block the other.
 */
export async function queryRustStatusViaRcon(input: {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
}): Promise<RustStatusInfo> {
  const [statusResult, playerListCount] = await Promise.all([
    runWebRconCommand({ ...input, command: "status" }).then((r) => parseStatusOutput(r.output)),
    queryRustPlayerList(input).catch(() => null),
  ]);

  return {
    ...statusResult,
    players: playerListCount ?? statusResult.players,
  };
}
