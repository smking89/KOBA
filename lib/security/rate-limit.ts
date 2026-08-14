type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
};

/**
 * Simple in-memory sliding window limiter for auth endpoints.
 * Replace with Redis / Upstash in production multi-instance deployments.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

export function resetRateLimitStore(): void {
  buckets.clear();
}
