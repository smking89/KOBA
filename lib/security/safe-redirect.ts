/**
 * Same-origin redirect guard (KOBA-SEC-002).
 *
 * `callbackUrl` query values are attacker-controlled. Only relative paths that
 * cannot escape the current origin are honoured; everything else falls back.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/enter"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  // "//host" is protocol-relative and "/\host" is normalized to it by browsers.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\")) return fallback;
  // Control characters enable header/URL splitting tricks.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
