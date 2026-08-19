import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { assertSafeHostname, SsrfError } from "@/features/servers/lib/ssrf";
import {
  AIDEN_FETCH_TIMEOUT_MS,
  AIDEN_MAX_OUTPUT_BYTES,
} from "@/features/aiden/lib/output-validation";

export async function assertSafeProviderUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Provider URL is not valid.", "INVALID_HOST");
  }
  if (url.protocol !== "https:") {
    throw new SsrfError("Provider URLs must use https.", "PROTOCOL");
  }
  if (url.username || url.password) {
    throw new SsrfError("Provider URLs may not include credentials.", "INVALID_HOST");
  }
  assertSafeHostname(url.hostname);
  if (isIP(url.hostname) === 0) {
    const records = await lookup(url.hostname, { all: true });
    for (const record of records) {
      assertSafeHostname(record.address);
    }
  }
  return url;
}

/** `accept`/`maxBytes` default to the original image-only behavior —
 * features/aiden/lib/blender-assembly.ts overrides both to pull down a
 * Tripo mesh (AIDEN_MESH_ACCEPT/AIDEN_MAX_MESH_BYTES), which is a very
 * different size/type class than the flat PNG/JPEG this function was
 * originally built for. */
export async function fetchProviderBytes(
  rawUrl: string,
  opts?: { accept?: string; maxBytes?: number },
): Promise<Buffer> {
  const maxBytes = opts?.maxBytes ?? AIDEN_MAX_OUTPUT_BYTES;
  const url = await assertSafeProviderUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIDEN_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: opts?.accept ?? "image/png,image/jpeg,image/webp" },
    });
    if (!response.ok) {
      throw new Error(`Provider download failed (${response.status}).`);
    }
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > maxBytes) {
      throw new Error("Provider response is too large.");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new Error("Provider response is too large.");
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}
