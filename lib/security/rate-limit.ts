import { bumpWindow, emitAlert } from "@/lib/observability/alerts";
import { logger } from "@/lib/observability/logger";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
};

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { success: true, limit, remaining: limit - bucket.count };
}

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rl:${key}`;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const response = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSeconds, "NX"],
      ["TTL", redisKey],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    logger.warn("Upstash rate limit HTTP failure; falling back to memory", {
      event: "redis_degraded",
      operation: "rate_limit",
      outcome: "degraded",
      extra: { status: response.status },
    });
    if (bumpWindow("redis_rate_limit") >= 5) {
      void emitAlert("redis_failure", "Upstash rate limit failed repeatedly", {
        labels: { operation: "rate_limit", errorClass: "redis" },
      });
    }
    return memoryRateLimit(key, limit, windowMs);
  }

  const payload = (await response.json()) as Array<{ result: number }>;
  const count = Number(payload[0]?.result ?? 0);
  const ttl = Number(payload[2]?.result ?? windowSeconds);

  if (count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - count),
  };
}

/**
 * Sliding / fixed-window rate limiter.
 * Uses Upstash Redis REST when configured; otherwise in-memory (single instance).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (isUpstashConfigured()) {
    try {
      return await upstashRateLimit(key, limit, windowMs);
    } catch (error) {
      logger.warn(
        "Upstash rate limit error; falling back to memory",
        {
          event: "redis_degraded",
          operation: "rate_limit",
          outcome: "degraded",
        },
        error,
      );
      if (bumpWindow("redis_rate_limit") >= 5) {
        void emitAlert("redis_failure", "Upstash rate limit failed repeatedly", {
          labels: { operation: "rate_limit", errorClass: "redis" },
          error,
        });
      }
      return memoryRateLimit(key, limit, windowMs);
    }
  }

  return memoryRateLimit(key, limit, windowMs);
}

export function resetRateLimitStore(): void {
  buckets.clear();
}
