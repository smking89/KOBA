import type { NormalizedStatusResult } from "@/features/servers/adapters/types";
import {
  DEFAULT_QUERY_TIMEOUTS,
  revalidateResolvedIp,
  type ResolvedTarget,
} from "@/features/servers/lib/ssrf";

/** Injectable UDP transport — tests never open real sockets. */
export type A2sTransport = (opts: {
  ip: string;
  port: number;
  packet: Buffer;
  timeoutMs: number;
  maxResponseBytes: number;
}) => Promise<Buffer>;

const A2S_INFO_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
const A2S_INFO_PAYLOAD = Buffer.concat([A2S_INFO_HEADER, Buffer.from("Source Engine Query\0")]);

export type A2sInfo = {
  name: string | null;
  map: string | null;
  players: number | null;
  maxPlayers: number | null;
  version: string | null;
  keywords: string | null;
  tags: string[];
  queue: number | null;
};

function readCString(buf: Buffer, offset: { value: number }): string {
  const start = offset.value;
  const end = buf.indexOf(0, start);
  if (end < 0) {
    offset.value = buf.length;
    return buf.subarray(start).toString("utf8");
  }
  offset.value = end + 1;
  return buf.subarray(start, end).toString("utf8");
}

/** Parse Valve A2S_INFO (0x49). See developer.valvesoftware.com/wiki/Server_queries */
export function parseA2sInfo(buf: Buffer): A2sInfo {
  const empty: A2sInfo = {
    name: null,
    map: null,
    players: null,
    maxPlayers: null,
    version: null,
    keywords: null,
    tags: [],
    queue: null,
  };
  if (buf.length < 6) return empty;
  let i = 0;
  if (buf[0] === 0xff && buf[1] === 0xff && buf[2] === 0xff && buf[3] === 0xff) {
    i = 4;
  }
  if (buf[i] !== 0x49) return empty;
  i += 1; // header
  i += 1; // protocol
  const cursor = { value: i };
  const name = readCString(buf, cursor) || null;
  const map = readCString(buf, cursor) || null;
  readCString(buf, cursor); // folder
  readCString(buf, cursor); // game
  if (cursor.value + 9 > buf.length) {
    return { ...empty, name, map };
  }
  cursor.value += 2; // steam app id
  const players = buf[cursor.value] ?? null;
  cursor.value += 1;
  const maxPlayers = buf[cursor.value] ?? null;
  cursor.value += 1;
  cursor.value += 1; // bots
  cursor.value += 1; // server type
  cursor.value += 1; // environment
  cursor.value += 1; // visibility
  cursor.value += 1; // vac
  const version = readCString(buf, cursor) || null;
  let keywords: string | null = null;
  if (cursor.value < buf.length) {
    const edf = buf[cursor.value] ?? 0;
    cursor.value += 1;
    if (edf & 0x80) cursor.value += 2;
    if (edf & 0x10) cursor.value += 8;
    if (edf & 0x40) {
      cursor.value += 2;
      readCString(buf, cursor);
    }
    if (edf & 0x20) {
      keywords = readCString(buf, cursor) || null;
    }
  }
  const tags = keywords
    ? keywords
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  return {
    name,
    map,
    players: players == null ? null : players,
    maxPlayers: maxPlayers == null ? null : maxPlayers,
    version,
    keywords,
    tags,
    queue: queueFromKeywords(keywords),
  };
}

/**
 * Facepunch server-browser keywords include `qpN` for queued players.
 * Only claim queue when that token is present.
 */
export function queueFromKeywords(keywords: string | null | undefined): number | null {
  if (!keywords) return null;
  const match = keywords.split(",").find((part) => /^qp\d+$/i.test(part.trim()));
  if (!match) return null;
  return Number.parseInt(match.slice(2), 10);
}

export function isA2sChallenge(buf: Buffer): boolean {
  const start = buf[0] === 0xff ? 4 : 0;
  return buf[start] === 0x41 && buf.length >= start + 5;
}

export function a2sInfoPacket(challenge?: Buffer): Buffer {
  if (!challenge) return A2S_INFO_PAYLOAD;
  return Buffer.concat([A2S_INFO_PAYLOAD, challenge.subarray(0, 4)]);
}

export function extractChallenge(buf: Buffer): Buffer {
  const start = buf[0] === 0xff ? 4 : 0;
  return buf.subarray(start + 1, start + 5);
}

export async function queryA2sInfo(
  target: ResolvedTarget,
  transport: A2sTransport,
): Promise<{ info: A2sInfo; pingMs: number | null; error: string | null }> {
  const started = Date.now();
  let lastError: string | null = null;

  for (const ip of target.resolvedIps) {
    revalidateResolvedIp(ip);
    try {
      let response = await transport({
        ip,
        port: target.port,
        packet: a2sInfoPacket(),
        timeoutMs: DEFAULT_QUERY_TIMEOUTS.totalMs,
        maxResponseBytes: DEFAULT_QUERY_TIMEOUTS.maxResponseBytes,
      });
      if (response.byteLength > DEFAULT_QUERY_TIMEOUTS.maxResponseBytes) {
        throw new Error("RESPONSE_TOO_LARGE");
      }
      if (isA2sChallenge(response)) {
        response = await transport({
          ip,
          port: target.port,
          packet: a2sInfoPacket(extractChallenge(response)),
          timeoutMs: DEFAULT_QUERY_TIMEOUTS.totalMs,
          maxResponseBytes: DEFAULT_QUERY_TIMEOUTS.maxResponseBytes,
        });
      }
      const info = parseA2sInfo(response);
      if (!info.name && info.players == null) {
        return { info, pingMs: null, error: "PROTOCOL_MISMATCH" };
      }
      return { info, pingMs: Date.now() - started, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "QUERY_FAILED";
    }
  }

  return {
    info: parseA2sInfo(Buffer.alloc(0)),
    pingMs: null,
    error: lastError ?? "UNREACHABLE",
  };
}

export function a2sToStatus(
  info: A2sInfo,
  pingMs: number | null,
  error: string | null,
): NormalizedStatusResult {
  const successful = error == null && (info.name != null || info.players != null);
  return {
    operationalState: successful ? "ONLINE" : "UNKNOWN",
    livePlayers: info.players,
    maxPlayers: info.maxPlayers,
    queue: info.queue,
    mapName: info.map,
    mapSize: null,
    pingMs,
    successful,
    errorCategory: error,
    source: "rust-a2s",
    serverName: info.name,
    serverTags: info.tags.length ? info.tags : null,
    rustVersion: info.version,
    fieldPresence: {
      livePlayers: info.players == null ? (error ? "FAILED" : "UNSUPPORTED") : "AVAILABLE",
      maxPlayers: info.maxPlayers == null ? (error ? "FAILED" : "UNSUPPORTED") : "AVAILABLE",
      queue: info.queue == null ? "UNSUPPORTED" : "AVAILABLE",
      mapName: info.map == null ? (error ? "FAILED" : "UNSUPPORTED") : "AVAILABLE",
      mapSize: "UNSUPPORTED",
      pingMs: pingMs == null ? (error ? "FAILED" : "UNSUPPORTED") : "AVAILABLE",
      serverName: info.name == null ? (error ? "FAILED" : "UNSUPPORTED") : "AVAILABLE",
      serverTags: info.tags.length ? "AVAILABLE" : "UNSUPPORTED",
      rustVersion: info.version == null ? "UNSUPPORTED" : "AVAILABLE",
    },
  };
}
