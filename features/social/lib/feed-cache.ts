import { isUpstashConfigured } from "@/lib/security/rate-limit";
import type { FeedCursor } from "@/features/social/lib/feed-ranking";

/**
 * Caches only the ranked (score, id) list for a candidate window — never
 * post content. That's the expensive-to-recompute part (candidate query +
 * engagement counts + scoring across the whole window); the actual post
 * rows for whatever page is being served are always fetched fresh by id,
 * so a cache hit can never serve stale/edited/moderated content, only a
 * slightly stale *ranking order* for up to FEED_CACHE_TTL_SECONDS.
 *
 * Same fail-soft shape as lib/security/rate-limit.ts: Upstash Redis REST
 * when configured, otherwise an in-memory Map (single instance only).
 */
export const FEED_CACHE_TTL_SECONDS = 30;

type CacheEntry = { value: FeedCursor[]; expiresAt: number };
const memoryStore = new Map<string, CacheEntry>();

function memoryGet(key: string): FeedCursor[] | null {
  const entry = memoryStore.get(key);
  if (!entry || Date.now() >= entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: FeedCursor[], ttlSeconds: number): void {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function upstashGet(key: string): Promise<FeedCursor[] | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const response = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Upstash GET failed (${response.status})`);
  }
  const payload = (await response.json()) as { result: string | null };
  if (!payload.result) {
    return null;
  }
  try {
    return JSON.parse(payload.result) as FeedCursor[];
  } catch {
    return null;
  }
}

async function upstashSet(key: string, value: FeedCursor[], ttlSeconds: number): Promise<void> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const response = await fetch(`${base}/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Upstash SET failed (${response.status})`);
  }
}

export async function getCachedRankedIds(key: string): Promise<FeedCursor[] | null> {
  if (isUpstashConfigured()) {
    try {
      return await upstashGet(`feed:${key}`);
    } catch (error) {
      console.error("[KOBA] Upstash feed cache read failed; falling back to memory.", error);
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

export async function setCachedRankedIds(
  key: string,
  value: FeedCursor[],
  ttlSeconds: number = FEED_CACHE_TTL_SECONDS,
): Promise<void> {
  if (isUpstashConfigured()) {
    try {
      await upstashSet(`feed:${key}`, value, ttlSeconds);
      return;
    } catch (error) {
      console.error("[KOBA] Upstash feed cache write failed; falling back to memory.", error);
    }
  }
  memorySet(key, value, ttlSeconds);
}

export function resetFeedCacheStore(): void {
  memoryStore.clear();
}
