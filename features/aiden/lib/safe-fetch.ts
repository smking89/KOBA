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

export async function fetchProviderBytes(rawUrl: string): Promise<Buffer> {
  const url = await assertSafeProviderUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIDEN_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "image/png,image/jpeg,image/webp" },
    });
    if (!response.ok) {
      throw new Error(`Provider download failed (${response.status}).`);
    }
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > AIDEN_MAX_OUTPUT_BYTES) {
      throw new Error("Provider response is too large.");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > AIDEN_MAX_OUTPUT_BYTES) {
      throw new Error("Provider response is too large.");
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}
