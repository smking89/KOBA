import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { ServerCapability } from "@/features/servers/lib/types";

export type SsrfRejectReason =
  | "EMPTY_HOST"
  | "INVALID_HOST"
  | "LOOPBACK"
  | "PRIVATE_IPV4"
  | "PRIVATE_IPV6"
  | "LINK_LOCAL"
  | "MULTICAST"
  | "RESERVED"
  | "METADATA"
  | "DNS_REBINDING"
  | "DISALLOWED_PORT"
  | "PROTOCOL"
  | "URL_FETCH";

export class SsrfError extends Error {
  constructor(
    message: string,
    readonly reason: SsrfRejectReason,
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

/** Cloud metadata / link-local specials commonly abused for SSRF. */
const METADATA_IPS = new Set(["169.254.169.254", "169.254.170.2", "fd00:ec2::254"]);

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function isPrivateOrSpecialIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("ff")) return true; // multicast
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateIpv4(v4);
  }
  return false;
}

export function assertSafeIpLiteral(ip: string): void {
  const version = isIP(ip);
  if (version === 0) {
    throw new SsrfError("Address is not a valid IP.", "INVALID_HOST");
  }
  if (METADATA_IPS.has(ip) || METADATA_IPS.has(ip.toLowerCase())) {
    throw new SsrfError("Cloud metadata endpoints are blocked.", "METADATA");
  }
  if (version === 4) {
    if (ip.startsWith("127.")) throw new SsrfError("Loopback addresses are blocked.", "LOOPBACK");
    if (isPrivateIpv4(ip)) {
      if (ip.startsWith("169.254.")) {
        throw new SsrfError("Link-local addresses are blocked.", "LINK_LOCAL");
      }
      if (Number(ip.split(".")[0]) >= 224) {
        throw new SsrfError("Multicast/reserved ranges are blocked.", "MULTICAST");
      }
      throw new SsrfError("Private IPv4 ranges are blocked.", "PRIVATE_IPV4");
    }
    return;
  }
  if (isPrivateOrSpecialIpv6(ip)) {
    if (ip === "::1") throw new SsrfError("Loopback addresses are blocked.", "LOOPBACK");
    if (ip.toLowerCase().startsWith("fe80")) {
      throw new SsrfError("Link-local addresses are blocked.", "LINK_LOCAL");
    }
    if (ip.toLowerCase().startsWith("ff")) {
      throw new SsrfError("Multicast/reserved ranges are blocked.", "MULTICAST");
    }
    throw new SsrfError("Private IPv6 ranges are blocked.", "PRIVATE_IPV6");
  }
}

export function assertSafeHostname(host: string): void {
  const trimmed = host.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) throw new SsrfError("Host is required.", "EMPTY_HOST");
  if (trimmed.includes("://") || trimmed.includes("/") || trimmed.includes("?")) {
    throw new SsrfError("Arbitrary URL fetching is not allowed.", "URL_FETCH");
  }
  if (
    BLOCKED_HOSTNAMES.has(trimmed) ||
    trimmed.endsWith(".localhost") ||
    trimmed.endsWith(".local")
  ) {
    throw new SsrfError("Loopback/local hostnames are blocked.", "LOOPBACK");
  }
  if (trimmed === "metadata" || trimmed.includes("metadata.google")) {
    throw new SsrfError("Cloud metadata endpoints are blocked.", "METADATA");
  }
  if (isIP(trimmed)) {
    assertSafeIpLiteral(trimmed);
  }
}

export function assertAllowedPort(port: number, allowedPorts?: readonly number[]): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SsrfError("Port is out of range.", "DISALLOWED_PORT");
  }
  if (allowedPorts && allowedPorts.length > 0 && !allowedPorts.includes(port)) {
    throw new SsrfError(`Port ${port} is not allowed for this adapter.`, "DISALLOWED_PORT");
  }
  // Block well-known local admin ports even when adapter is permissive
  const blocked = new Set([22, 23, 25, 111, 135, 139, 445, 3306, 5432, 6379, 11211, 27017]);
  if (blocked.has(port)) {
    throw new SsrfError(`Port ${port} is blocked.`, "DISALLOWED_PORT");
  }
}

export type ResolvedTarget = {
  hostname: string;
  resolvedIps: string[];
  port: number;
};

/**
 * Resolve DNS and re-validate every A/AAAA record (rebinding defence).
 * Callers must connect only to these IPs and re-check before connect.
 */
export async function resolveSafeTarget(
  hostname: string,
  port: number,
  opts?: { allowedPorts?: readonly number[]; lookupFn?: typeof lookup },
): Promise<ResolvedTarget> {
  assertSafeHostname(hostname);
  assertAllowedPort(port, opts?.allowedPorts);

  if (isIP(hostname)) {
    assertSafeIpLiteral(hostname);
    return { hostname, resolvedIps: [hostname], port };
  }

  const dnsLookup = opts?.lookupFn ?? lookup;
  let records: { address: string; family: number }[];
  try {
    const result = await dnsLookup(hostname, { all: true, verbatim: true });
    records = Array.isArray(result) ? result : [result];
  } catch {
    throw new SsrfError("DNS resolution failed.", "INVALID_HOST");
  }

  if (!records.length) {
    throw new SsrfError("DNS resolution returned no addresses.", "INVALID_HOST");
  }

  const ips = records.map((r) => r.address);
  for (const ip of ips) {
    try {
      assertSafeIpLiteral(ip);
    } catch (error) {
      if (error instanceof SsrfError) {
        throw new SsrfError(
          `DNS rebinding defence: resolved address rejected (${error.reason}).`,
          "DNS_REBINDING",
        );
      }
      throw error;
    }
  }

  return { hostname, resolvedIps: ips, port };
}

/** Re-validate an IP immediately before opening a socket (TOCTOU / rebinding). */
export function revalidateResolvedIp(ip: string): void {
  assertSafeIpLiteral(ip);
}

export type QueryTimeouts = {
  connectMs: number;
  totalMs: number;
  maxResponseBytes: number;
};

export const DEFAULT_QUERY_TIMEOUTS: QueryTimeouts = {
  connectMs: 2_000,
  totalMs: 4_000,
  maxResponseBytes: 8_192,
};

export function capabilitiesRequireNetwork(caps: readonly ServerCapability[]): boolean {
  return caps.includes("PUBLIC_QUERY") || caps.includes("STATUS");
}
