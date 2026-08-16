/**
 * Pure lazy-expiry predicate — there's no cron flipping APPLIED -> EXPIRED
 * on a timer, so "is this boost actually still active" is always computed
 * from status + expiresAt at read time. Used by
 * activeBoostedTargetIds's DB query and by the wallet UI to gray out an
 * applied Boost once its 10 minutes are up, without a background job.
 */
export function isBoostCurrentlyActive(
  boost: { status: string; expiresAt: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (boost.status !== "APPLIED" || !boost.expiresAt) {
    return false;
  }
  const expiresAt =
    typeof boost.expiresAt === "string" ? new Date(boost.expiresAt) : boost.expiresAt;
  return expiresAt.getTime() > now.getTime();
}
