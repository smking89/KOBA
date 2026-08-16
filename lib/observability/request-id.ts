import { isValidRequestId } from "@/lib/observability/config";

function randomId(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < bytes; i += 1) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newRequestId(): string {
  return `req_${randomId(12)}`;
}

export function newErrorId(): string {
  return `koba_err_${randomId(8)}`;
}

export function newCorrelationId(): string {
  return `cor_${randomId(12)}`;
}

/**
 * Accepts a caller-supplied ID only when it matches the safe charset/length.
 * Invalid, empty, or oversized values are replaced — never reflected into headers.
 */
export function resolveRequestId(candidate: string | null | undefined): string {
  if (isValidRequestId(candidate)) return candidate;
  return newRequestId();
}
