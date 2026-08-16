const SECRET_KEY = /^(password|secret|ciphertext|authTag|iv|rconPassword|authorization)$/i;

export function containsSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value as object).some((key) => SECRET_KEY.test(key));
}

export function assertNoSecrets<T>(payload: T): T {
  if (containsSecretKey(payload)) {
    throw new Error("Refusing to serialise a payload that includes credential fields.");
  }
  if (payload && typeof payload === "object") {
    for (const nested of Object.values(payload as Record<string, unknown>)) {
      if (nested && typeof nested === "object") {
        if (containsSecretKey(nested)) {
          throw new Error("Refusing to serialise a payload that includes credential fields.");
        }
      }
    }
  }
  return payload;
}

export function redactStructured(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStructured);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : redactStructured(nested);
  }
  return out;
}
