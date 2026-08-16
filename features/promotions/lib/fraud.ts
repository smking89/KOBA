export function clickBurstWindowMs(): number {
  const parsed = Number.parseInt(process.env.KOBA_CLICK_BURST_WINDOW_MS ?? "60000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

export function clickHashRetentionHours(): number {
  const parsed = Number.parseInt(process.env.KOBA_CLICK_HASH_RETENTION_HOURS ?? "48", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
}

export function adDuplicateWindowMs(): number {
  const parsed = Number.parseInt(process.env.KOBA_AD_DUPLICATE_WINDOW_MS ?? "30000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
}

export function defaultAdCpcCoins(): bigint {
  const parsed = Number.parseInt(process.env.KOBA_AD_CPC_DEFAULT ?? "5", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5n;
  return BigInt(parsed);
}

export function clickIdempotencyKey(token: string, visitorHash: string, bucketMs: number): string {
  const bucket = Math.floor(Date.now() / bucketMs);
  return `refclick:${token}:${visitorHash}:${bucket}`.slice(0, 128);
}

export function adClickIdempotencyKey(
  campaignId: string,
  viewerKey: string,
  bucketMs: number,
): string {
  const bucket = Math.floor(Date.now() / bucketMs);
  return `adclick:${campaignId}:${viewerKey}:${bucket}`.slice(0, 128);
}

export function canConsumeBudget(remaining: number, amount: number): boolean {
  return amount > 0 && remaining >= amount;
}

export function canIncrementUsage(usageCount: number, usageLimit: number | null): boolean {
  if (usageCount < 0) return false;
  return usageLimit == null || usageCount < usageLimit;
}

export function adImpressionIdempotencyKey(
  campaignId: string,
  viewerKey: string,
  bucketMs: number,
): string {
  const bucket = Math.floor(Date.now() / bucketMs);
  return `adimp:${campaignId}:${viewerKey}:${bucket}`.slice(0, 128);
}
