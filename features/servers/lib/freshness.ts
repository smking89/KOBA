import type { MetricDisplayState, FreshnessMeta } from "@/features/servers/lib/types";

export const DEFAULT_FRESH_MS = 90_000;

export function buildFreshness(input: {
  checkedAt: Date | null | undefined;
  lastSuccessfulAt: Date | null | undefined;
  freshUntil: Date | null | undefined;
  source: string;
  now?: Date;
}): FreshnessMeta {
  const now = input.now ?? new Date();
  const freshUntil = input.freshUntil ?? null;
  const isStale = !freshUntil || freshUntil.getTime() <= now.getTime();
  return {
    checkedAt: input.checkedAt?.toISOString() ?? null,
    lastSuccessfulAt: input.lastSuccessfulAt?.toISOString() ?? null,
    freshUntil: freshUntil?.toISOString() ?? null,
    isStale,
    source: input.source,
  };
}

export function computeFreshUntil(from: Date, ttlMs = DEFAULT_FRESH_MS): Date {
  return new Date(from.getTime() + ttlMs);
}

export function metricState(opts: {
  supported: boolean;
  valuePresent: boolean;
  isStale: boolean;
  transientFailure?: boolean;
}): MetricDisplayState {
  if (!opts.supported) return "NOT_SUPPORTED";
  if (opts.transientFailure && !opts.valuePresent) return "TEMPORARILY_UNAVAILABLE";
  if (!opts.valuePresent) return "UNKNOWN";
  if (opts.isStale) return "STALE";
  return "AVAILABLE";
}
