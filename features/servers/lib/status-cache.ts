import { isUpstashConfigured } from "@/lib/security/rate-limit";
import type { SourceServerInfo } from "@/features/servers/lib/rcon/source-query";

/**
 * Short-TTL cache for on-demand live server queries — client-confirmed
 * polling model (2026-08-15): query only when a server's page is viewed,
 * cache the result briefly, no persistent connections or a scheduled
 * sweep of every registered server regardless of traffic. Same fail-soft
 * Upstash/in-memory shape as features/social/lib/feed-cache.ts and
 * lib/security/rate-limit.ts.
 */
export const LIVE_STATUS_TTL_SECONDS = 45;

type CacheEntry = { value: SourceServerInfo; expiresAt: number };
const memoryStore = new Map<string, CacheEntry>();

function memoryGet(key: string): SourceServerInfo | null {
  const entry = memoryStore.get(key);
  if (!entry || Date.now() >= entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: SourceServerInfo, ttlSeconds: number): void {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function upstashGet(key: string): Promise<SourceServerInfo | null> {
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
    return JSON.parse(payload.result) as SourceServerInfo;
  } catch {
    return null;
  }
}

async function upstashSet(
  key: string,
  value: SourceServerInfo,
  ttlSeconds: number,
): Promise<void> {
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

export async function getCachedServerStatus(serverId: string): Promise<SourceServerInfo | null> {
  const key = `server-status:${serverId}`;
  if (isUpstashConfigured()) {
    try {
      return await upstashGet(key);
    } catch (error) {
      console.error("[KOBA] Upstash server-status cache read failed; falling back to memory.", error);
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

export async function setCachedServerStatus(
  serverId: string,
  value: SourceServerInfo,
  ttlSeconds: number = LIVE_STATUS_TTL_SECONDS,
): Promise<void> {
  const key = `server-status:${serverId}`;
  if (isUpstashConfigured()) {
    try {
      await upstashSet(key, value, ttlSeconds);
      return;
    } catch (error) {
      console.error("[KOBA] Upstash server-status cache write failed; falling back to memory.", error);
    }
  }
  memorySet(key, value, ttlSeconds);
}
