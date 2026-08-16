import { createSocket } from "node:dgram";

/**
 * Valve's A2S_INFO server query (UDP) — public, unauthenticated protocol
 * used to read live player count/map/server name without an RCON
 * password. This is the correct protocol for "live stats" polling (RCON
 * is for authenticated admin commands, a materially different concern —
 * see source-rcon.ts); server browsers/trackers use A2S, not RCON, for
 * exactly this reason. Wire format per Valve's public "Server queries"
 * documentation — stable, long-standing protocol, high confidence.
 *
 * Modern Source servers require a challenge/response round trip
 * (introduced ~2020 to mitigate reflection-amplification DDoS abuse):
 * the first request gets a 4-byte challenge back (header 0x41), which
 * must be appended to a second request to get the real 0x49 response.
 */

const A2S_INFO_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
const A2S_QUERY_STRING = Buffer.from("Source Engine Query\0", "ascii");

export class SourceQueryError extends Error {
  constructor(
    message: string,
    readonly kind: "TIMEOUT" | "MALFORMED_RESPONSE",
  ) {
    super(message);
    this.name = "SourceQueryError";
  }
}

export type SourceServerInfo = {
  serverName: string;
  mapName: string;
  players: number;
  maxPlayers: number;
};

export function buildRequest(challenge?: Buffer): Buffer {
  return Buffer.concat([A2S_INFO_HEADER, A2S_QUERY_STRING, challenge ?? Buffer.alloc(0)]);
}

function readCString(buf: Buffer, offset: number): { value: string; next: number } {
  const end = buf.indexOf(0x00, offset);
  if (end === -1) {
    throw new SourceQueryError(
      "Malformed A2S_INFO response (unterminated string).",
      "MALFORMED_RESPONSE",
    );
  }
  return { value: buf.toString("utf8", offset, end), next: end + 1 };
}

export function parseInfoResponse(buf: Buffer): SourceServerInfo {
  // buf[0..4] = FF FF FF FF, buf[4] = 'I' (0x49), buf[5] = protocol version
  let offset = 6;
  const name = readCString(buf, offset);
  offset = name.next;
  const map = readCString(buf, offset);
  offset = map.next;
  const folder = readCString(buf, offset);
  offset = folder.next;
  const game = readCString(buf, offset);
  offset = game.next;
  offset += 2; // steam app id (short)
  const players = buf.readUInt8(offset);
  offset += 1;
  const maxPlayers = buf.readUInt8(offset);

  return { serverName: name.value, mapName: map.value, players, maxPlayers };
}

/** One-shot UDP query with the required challenge round trip. */
export async function queryServerInfo(input: {
  host: string;
  port: number;
  timeoutMs?: number;
}): Promise<SourceServerInfo> {
  const timeoutMs = input.timeoutMs ?? 3000;

  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(new SourceQueryError("A2S_INFO query timed out.", "TIMEOUT"));
    }, timeoutMs);

    function finish(fn: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      fn();
    }

    socket.on("error", (error) => {
      finish(() => reject(new SourceQueryError(`Query socket error: ${error.message}`, "TIMEOUT")));
    });

    socket.on("message", (msg: Buffer) => {
      const header = msg.readUInt8(4);
      if (header === 0x41) {
        // Challenge response — resend with the challenge bytes appended.
        const challenge = msg.subarray(5, 9);
        socket.send(buildRequest(challenge), input.port, input.host);
        return;
      }
      if (header === 0x49) {
        finish(() => {
          try {
            resolve(parseInfoResponse(msg));
          } catch (error) {
            reject(error);
          }
        });
        return;
      }
      // Unrecognized header — ignore and keep waiting until timeout.
    });

    socket.send(buildRequest(), input.port, input.host);
  });
}
