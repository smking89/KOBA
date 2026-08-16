import { Socket } from "node:net";

/**
 * Valve Source RCON protocol (SERVERDATA_AUTH / SERVERDATA_EXECCOMMAND /
 * SERVERDATA_RESPONSE_VALUE over TCP) — the protocol Rust and Garry's Mod
 * (both Source-engine titles) use for admin commands. Wire format per
 * Valve's public "Source RCON Protocol" documentation: a stable,
 * unchanged-in-over-a-decade binary protocol, widely implemented by every
 * third-party RCON tool for these games — high confidence, not an
 * inferred/guessed shape.
 *
 * Packet layout (all integers little-endian):
 *   [Size:int32][ID:int32][Type:int32][Body:cstring][pad:0x00]
 * Size counts everything after itself (ID + Type + Body + null terminator
 * + the trailing pad byte).
 */

const PACKET_TYPE = {
  SERVERDATA_EXECCOMMAND: 2,
  SERVERDATA_AUTH: 3,
} as const;

const RESPONSE_TYPE = {
  SERVERDATA_RESPONSE_VALUE: 0,
  SERVERDATA_AUTH_RESPONSE: 2,
} as const;

export class SourceRconError extends Error {
  constructor(
    message: string,
    readonly kind: "TIMEOUT" | "AUTH_FAILED" | "CONNECTION_FAILED",
  ) {
    super(message);
    this.name = "SourceRconError";
  }
}

export function encodePacket(id: number, type: number, body: string): Buffer {
  const bodyBuf = Buffer.from(body, "ascii");
  const size = 4 + 4 + bodyBuf.length + 1 + 1; // ID + Type + body + null + pad
  const packet = Buffer.alloc(4 + size);
  packet.writeInt32LE(size, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  bodyBuf.copy(packet, 12);
  packet.writeUInt8(0, 12 + bodyBuf.length);
  packet.writeUInt8(0, 12 + bodyBuf.length + 1);
  return packet;
}

type DecodedPacket = { id: number; type: number; body: string };

export function decodePacket(buf: Buffer): DecodedPacket {
  const id = buf.readInt32LE(0);
  const type = buf.readInt32LE(4);
  const body = buf.toString("ascii", 8, buf.length - 2);
  return { id, type, body };
}

/**
 * Opens a TCP connection, authenticates, optionally runs one command, then
 * closes. One-shot rather than a kept-open connection — matches the
 * on-demand-query polling model (features/servers/lib/status-cache.ts),
 * not a persistent-connection architecture.
 */
export async function runRconCommand(input: {
  host: string;
  port: number;
  password: string;
  command?: string;
  timeoutMs?: number;
}): Promise<{ authenticated: boolean; output: string | null }> {
  const timeoutMs = input.timeoutMs ?? 5000;

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let stage: "connecting" | "authing" | "executing" | "done" = "connecting";
    let buffered = Buffer.alloc(0);
    const authId = Math.floor(Math.random() * 1_000_000) + 1;

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new SourceRconError("RCON request timed out.", "TIMEOUT"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.destroy();
    }

    socket.on("error", () => {
      cleanup();
      reject(new SourceRconError("Could not connect to the RCON port.", "CONNECTION_FAILED"));
    });

    socket.connect(input.port, input.host, () => {
      stage = "authing";
      socket.write(encodePacket(authId, PACKET_TYPE.SERVERDATA_AUTH, input.password));
    });

    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);

      // A full packet needs at least the 4-byte size prefix plus that
      // many more bytes.
      while (buffered.length >= 4) {
        const size = buffered.readInt32LE(0);
        if (buffered.length < 4 + size) {
          break; // wait for more data
        }
        const raw = buffered.subarray(4, 4 + size);
        buffered = buffered.subarray(4 + size);
        const packet = decodePacket(raw);

        if (stage === "authing") {
          // Some server implementations send an empty
          // SERVERDATA_RESPONSE_VALUE immediately before the real
          // SERVERDATA_AUTH_RESPONSE — only the auth-response type
          // packet's id determines success (-1 == failed).
          if (packet.type === RESPONSE_TYPE.SERVERDATA_AUTH_RESPONSE) {
            if (packet.id === -1) {
              cleanup();
              reject(new SourceRconError("RCON password rejected.", "AUTH_FAILED"));
              return;
            }
            if (!input.command) {
              cleanup();
              resolve({ authenticated: true, output: null });
              return;
            }
            stage = "executing";
            socket.write(
              encodePacket(authId + 1, PACKET_TYPE.SERVERDATA_EXECCOMMAND, input.command),
            );
          }
          continue;
        }

        if (stage === "executing" && packet.type === RESPONSE_TYPE.SERVERDATA_RESPONSE_VALUE) {
          cleanup();
          resolve({ authenticated: true, output: packet.body });
          return;
        }
      }
    });
  });
}
