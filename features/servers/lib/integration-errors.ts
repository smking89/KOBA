export const INTEGRATION_ERROR_CATEGORIES = [
  "INVALID_CREDENTIALS",
  "TIMEOUT",
  "UNREACHABLE",
  "UNSUPPORTED_SERVER",
  "PROTOCOL_MISMATCH",
  "RATE_LIMITED",
  "TLS_TRANSPORT_FAILURE",
  "INTERNAL_CONFIGURATION",
  "SSRF_REJECTED",
  "CIRCUIT_OPEN",
] as const;

export type IntegrationErrorCategory = (typeof INTEGRATION_ERROR_CATEGORIES)[number];

const SAFE_MESSAGES: Record<IntegrationErrorCategory, string> = {
  INVALID_CREDENTIALS: "The RCON password was rejected.",
  TIMEOUT: "The server did not respond in time.",
  UNREACHABLE: "The server could not be reached.",
  UNSUPPORTED_SERVER: "This server does not support the Rust PC integration.",
  PROTOCOL_MISMATCH: "The server did not speak the expected Rust protocol.",
  RATE_LIMITED: "Too many connection attempts. Try again later.",
  TLS_TRANSPORT_FAILURE: "The connection transport failed.",
  INTERNAL_CONFIGURATION: "Integration encryption or worker configuration is missing.",
  SSRF_REJECTED: "That host or port is not allowed.",
  CIRCUIT_OPEN: "This integration is temporarily paused after repeated failures.",
};

export function safeErrorMessage(category: IntegrationErrorCategory): string {
  return SAFE_MESSAGES[category];
}

export function classifyTransportError(error: unknown): IntegrationErrorCategory {
  if (error && typeof error === "object" && "category" in error) {
    const category = (error as { category?: string }).category;
    if (category && (INTEGRATION_ERROR_CATEGORIES as readonly string[]).includes(category)) {
      return category as IntegrationErrorCategory;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  const upper = message.toUpperCase();
  if (upper.includes("AUTH") || upper.includes("PASSWORD") || upper.includes("401")) {
    return "INVALID_CREDENTIALS";
  }
  if (upper.includes("TIMEOUT") || upper.includes("ETIMEDOUT") || upper.includes("ABORT")) {
    return "TIMEOUT";
  }
  if (
    upper.includes("ECONNREFUSED") ||
    upper.includes("ENOTFOUND") ||
    upper.includes("EHOSTUNREACH")
  ) {
    return "UNREACHABLE";
  }
  if (upper.includes("PROTOCOL") || upper.includes("UNEXPECTED")) {
    return "PROTOCOL_MISMATCH";
  }
  if (upper.includes("TLS") || upper.includes("SSL") || upper.includes("WS_UPGRADE")) {
    return "TLS_TRANSPORT_FAILURE";
  }
  if (upper.includes("SSRF") || upper.includes("BLOCKED") || upper.includes("PRIVATE")) {
    return "SSRF_REJECTED";
  }
  return "UNREACHABLE";
}
