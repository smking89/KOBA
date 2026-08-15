const REDACTED = "[Redacted]";

const SENSITIVE_KEY_RE =
  /password|passwd|pwd|secret|token|cookie|authorization|authheader|apikey|api[_-]?key|webhook|totp|otp|mfa|recovery|credential|rcon|privatekey|private[_-]?key|encryption|session|set-cookie|clientsecret|client[_-]?secret|signedurl|signed[_-]?url|bearer|jwt|dsn|prompt|rawbody|raw[_-]?body/i;

const SENSITIVE_EXACT = new Set([
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "password",
  "passwordhash",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "resettoken",
  "verificationtoken",
  "totp",
  "totpsecret",
  "totpcode",
  "mfcode",
  "mfacode",
  "recoverycode",
  "recoverycodes",
  "apikey",
  "webhooksecret",
  "stripesecret",
  "stripekey",
  "clientsecret",
  "rconpassword",
  "rcon",
  "encryptionkey",
  "credential",
  "credentials",
  "signedurl",
  "privatekey",
  "authtoken",
  "sentryauthtoken",
  "prompt",
  "messages",
  "directmessage",
  "dm",
  "html",
  "payload",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SENSITIVE_EXACT.has(normalized)) return true;
  return SENSITIVE_KEY_RE.test(key);
}

function redactPrimitive(value: string): string {
  if (/^(sk_live_|sk_test_|rk_live_|rk_test_|whsec_|pk_live_|pk_test_)/i.test(value)) {
    return REDACTED;
  }
  if (/^Bearer\s+\S+/i.test(value)) return REDACTED;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return REDACTED;
  return value;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[Truncated]";
  if (value == null) return value;
  if (typeof value === "string") return redactPrimitive(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactPrimitive(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = isSensitiveKey(key) ? REDACTED : redactValue(nested, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function redactHeaders(
  headers: Headers | Record<string, string | null | undefined> | undefined,
): Record<string, string> {
  const output: Record<string, string> = {};
  if (!headers) return output;
  const entries =
    headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers);
  for (const [key, value] of entries) {
    if (value == null) continue;
    output[key] = isSensitiveKey(key) ? REDACTED : redactPrimitive(String(value));
  }
  return output;
}
