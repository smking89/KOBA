import { createHash, randomBytes } from "node:crypto";
import { Socket } from "node:net";
import type { NormalizedStatusResult } from "@/features/servers/adapters/types";
import { commandForAction, type RustReadonlyAction } from "@/features/servers/lib/rcon-policy";
import { classifyTransportError } from "@/features/servers/lib/integration-errors";
import { revalidateResolvedIp, type ResolvedTarget } from "@/features/servers/lib/ssrf";

export const WEBRCON_CONNECT_MS = 3_000;
export const WEBRCON_COMMAND_MS = 4_000;
export const WEBRCON_MAX_RESPONSE_BYTES = 16_384;

export type WebRconRequest = {
  ip: string;
  port: number;
  hostHeader: string;
  password: string;
  action: RustReadonlyAction;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export type WebRconTransport = (request: WebRconRequest) => Promise<string>;

export type RustServerInfo = {
  Hostname?: string;
  MaxPlayers?: number;
  Players?: number;
  Queued?: number;
  Joining?: number;
  Map?: string;
  Framerate?: number;
};

export class WebRconError extends Error {
  constructor(
    message: string,
    readonly category:
      | "INVALID_CREDENTIALS"
      | "TIMEOUT"
      | "UNREACHABLE"
      | "PROTOCOL_MISMATCH"
      | "TLS_TRANSPORT_FAILURE",
  ) {
    super(message);
    this.name = "WebRconError";
  }
}

function encodeFrame(payload: Buffer): Buffer {
  const length = payload.length;
  const headerSize = length < 126 ? 6 : 8;
  const frame = Buffer.alloc(headerSize + length);
  frame[0] = 0x81;
  const mask = randomBytes(4);
  if (length < 126) {
    frame[1] = 0x80 | length;
    mask.copy(frame, 2);
    for (let i = 0; i < length; i += 1) {
      frame[6 + i] = payload[i]! ^ mask[i % 4]!;
    }
  } else {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(length, 2);
    mask.copy(frame, 4);
    for (let i = 0; i < length; i += 1) {
      frame[8 + i] = payload[i]! ^ mask[i % 4]!;
    }
  }
  return frame;
}

function decodeTextFrame(buf: Buffer, maxBytes: number): { text: string | null; consumed: number } {
  if (buf.length < 2) return { text: null, consumed: 0 };
  const opcode = buf[0]! & 0x0f;
  const masked = (buf[1]! & 0x80) !== 0;
  let length = buf[1]! & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buf.length < 4) return { text: null, consumed: 0 };
    length = buf.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    throw new WebRconError("WebRCON frame is too large.", "PROTOCOL_MISMATCH");
  }
  if (length > maxBytes) {
    throw new WebRconError("WebRCON response exceeded size limit.", "PROTOCOL_MISMATCH");
  }
  let mask: Buffer | null = null;
  if (masked) {
    if (buf.length < offset + 4) return { text: null, consumed: 0 };
    mask = buf.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buf.length < offset + length) return { text: null, consumed: 0 };
  const payload = Buffer.from(buf.subarray(offset, offset + length));
  if (mask) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] = payload[i]! ^ mask[i % 4]!;
    }
  }
  if (opcode === 0x8) {
    throw new WebRconError("WebRCON closed the socket.", "UNREACHABLE");
  }
  if (opcode !== 0x1) return { text: null, consumed: offset + length };
  return { text: payload.toString("utf8"), consumed: offset + length };
}

/**
 * Facepunch WebRCON: websocket to ws://ip:port/<password>, JSON
 * { Identifier, Message, Name: "WebRcon" }.
 * The password is used only for the handshake path and is never logged.
 */
export function createNativeWebRconTransport(): WebRconTransport {
  return async function nativeWebRcon(request) {
    revalidateResolvedIp(request.ip);
    const timeoutMs = request.timeoutMs ?? WEBRCON_CONNECT_MS + WEBRCON_COMMAND_MS;
    const maxBytes = request.maxResponseBytes ?? WEBRCON_MAX_RESPONSE_BYTES;
    const command = commandForAction(request.action);
    const identifier = 1 + Math.floor(Math.random() * 10_000);
    const body = JSON.stringify({
      Identifier: identifier,
      Message: command,
      Name: "WebRcon",
    });

    return new Promise<string>((resolve, reject) => {
      const socket = new Socket();
      let settled = false;
      let buffer = Buffer.alloc(0);
      let upgraded = false;
      const key = randomBytes(16).toString("base64");
      const expectedAccept = createHash("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");

      const finish = (error?: Error, value?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.removeAllListeners();
        socket.destroy();
        if (error) reject(error);
        else resolve(value ?? "");
      };

      const timer = setTimeout(() => {
        finish(new WebRconError("WebRCON timed out.", "TIMEOUT"));
      }, timeoutMs);

      socket.setNoDelay(true);
      socket.once("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
          finish(new WebRconError("WebRCON host unreachable.", "UNREACHABLE"));
          return;
        }
        finish(new WebRconError("WebRCON transport failed.", "TLS_TRANSPORT_FAILURE"));
      });

      socket.connect(request.port, request.ip, () => {
        const path = `/${encodeURIComponent(request.password)}`;
        const lines = [
          `GET ${path} HTTP/1.1`,
          `Host: ${request.hostHeader}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ];
        socket.write(lines.join("\r\n"));
      });

      socket.on("data", (chunk: Buffer) => {
        if (buffer.length + chunk.length > maxBytes + 2048) {
          finish(new WebRconError("WebRCON response exceeded size limit.", "PROTOCOL_MISMATCH"));
          return;
        }
        buffer = Buffer.concat([buffer, chunk]);
        if (!upgraded) {
          const headerEnd = buffer.indexOf("\r\n\r\n");
          if (headerEnd < 0) return;
          const header = buffer.subarray(0, headerEnd).toString("utf8");
          buffer = buffer.subarray(headerEnd + 4);
          if (header.startsWith("HTTP/1.1 401") || header.startsWith("HTTP/1.0 401")) {
            finish(new WebRconError("WebRCON authentication failed.", "INVALID_CREDENTIALS"));
            return;
          }
          if (!header.startsWith("HTTP/1.1 101") && !header.startsWith("HTTP/1.0 101")) {
            finish(new WebRconError("WebRCON upgrade rejected.", "INVALID_CREDENTIALS"));
            return;
          }
          if (!header.toLowerCase().includes("sec-websocket-accept:")) {
            finish(new WebRconError("WebRCON handshake was incomplete.", "PROTOCOL_MISMATCH"));
            return;
          }
          const acceptLine = header
            .split("\r\n")
            .find((line) => line.toLowerCase().startsWith("sec-websocket-accept:"));
          const accept = acceptLine?.split(":")[1]?.trim();
          if (accept !== expectedAccept) {
            finish(new WebRconError("WebRCON accept mismatch.", "PROTOCOL_MISMATCH"));
            return;
          }
          upgraded = true;
          socket.write(encodeFrame(Buffer.from(body, "utf8")));
        }

        while (upgraded && buffer.length >= 2) {
          try {
            const decoded = decodeTextFrame(buffer, maxBytes);
            if (!decoded.consumed) break;
            buffer = buffer.subarray(decoded.consumed);
            if (!decoded.text) continue;
            let parsed: { Identifier?: number; Message?: string; Type?: string };
            try {
              parsed = JSON.parse(decoded.text) as { Identifier?: number; Message?: string };
            } catch {
              finish(new WebRconError("WebRCON returned non-JSON.", "PROTOCOL_MISMATCH"));
              return;
            }
            if (parsed.Identifier === identifier || parsed.Message) {
              finish(undefined, parsed.Message ?? "");
              return;
            }
          } catch (error) {
            finish(
              error instanceof Error
                ? error
                : new WebRconError("WebRCON frame error.", "PROTOCOL_MISMATCH"),
            );
            return;
          }
        }
      });
    });
  };
}

export function parseServerInfoMessage(message: string): RustServerInfo | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as RustServerInfo;
  } catch {
    return null;
  }
}

export async function queryWebRconServerInfo(
  target: ResolvedTarget,
  opts: { password: string; hostHeader: string; transport?: WebRconTransport },
): Promise<NormalizedStatusResult> {
  const transport = opts.transport ?? createNativeWebRconTransport();
  let lastError: unknown = null;

  for (const ip of target.resolvedIps) {
    revalidateResolvedIp(ip);
    try {
      const message = await transport({
        ip,
        port: target.port,
        hostHeader: opts.hostHeader,
        password: opts.password,
        action: "SERVER_INFO",
        timeoutMs: WEBRCON_CONNECT_MS + WEBRCON_COMMAND_MS,
        maxResponseBytes: WEBRCON_MAX_RESPONSE_BYTES,
      });
      const info = parseServerInfoMessage(message);
      if (!info) {
        return {
          operationalState: "UNKNOWN",
          livePlayers: null,
          maxPlayers: null,
          queue: null,
          mapName: null,
          mapSize: null,
          pingMs: null,
          successful: false,
          errorCategory: "PROTOCOL_MISMATCH",
          source: "rust-webrcon",
        };
      }
      return serverInfoToStatus(info);
    } catch (error) {
      lastError = error;
      if (error instanceof WebRconError && error.category === "INVALID_CREDENTIALS") {
        break;
      }
    }
  }

  const category =
    lastError instanceof WebRconError ? lastError.category : classifyTransportError(lastError);
  return {
    operationalState: "UNKNOWN",
    livePlayers: null,
    maxPlayers: null,
    queue: null,
    mapName: null,
    mapSize: null,
    pingMs: null,
    successful: false,
    errorCategory: category,
    source: "rust-webrcon",
  };
}

export function serverInfoToStatus(info: RustServerInfo): NormalizedStatusResult {
  return {
    operationalState: "ONLINE",
    livePlayers: typeof info.Players === "number" ? info.Players : null,
    maxPlayers: typeof info.MaxPlayers === "number" ? info.MaxPlayers : null,
    queue: typeof info.Queued === "number" ? info.Queued : null,
    mapName: typeof info.Map === "string" ? info.Map : null,
    mapSize: null,
    pingMs: null,
    successful: true,
    errorCategory: null,
    source: "rust-webrcon",
    serverName: typeof info.Hostname === "string" ? info.Hostname : null,
    serverTags: null,
    rustVersion: null,
    fieldPresence: {
      livePlayers: typeof info.Players === "number" ? "AVAILABLE" : "UNSUPPORTED",
      maxPlayers: typeof info.MaxPlayers === "number" ? "AVAILABLE" : "UNSUPPORTED",
      queue: typeof info.Queued === "number" ? "AVAILABLE" : "UNSUPPORTED",
      mapName: typeof info.Map === "string" ? "AVAILABLE" : "UNSUPPORTED",
      mapSize: "UNSUPPORTED",
      pingMs: "UNSUPPORTED",
      serverName: typeof info.Hostname === "string" ? "AVAILABLE" : "UNSUPPORTED",
      serverTags: "UNSUPPORTED",
      rustVersion: "UNSUPPORTED",
    },
  };
}
