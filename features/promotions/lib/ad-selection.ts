export type SponsoredCandidate = {
  id: string;
  remainingBudgetCoins: bigint;
  dailyBudgetCoins: bigint;
  dailySpentCoins: bigint;
  dailySpentOn: Date | null;
  cpcCoins: bigint;
  frequencyCap: number;
  impressionsForViewer: number;
  targetGameId: string | null;
  targetCategoryId: string | null;
  targetPlatform: string | null;
  targetRegion: string | null;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  lastShownAt: Date | null;
};

export type AdContext = {
  gameId?: string | null;
  categoryId?: string | null;
  platform?: string | null;
  region?: string | null;
  now: Date;
};

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function isCampaignBillable(campaign: SponsoredCandidate, now: Date): boolean {
  if (campaign.status !== "ACTIVE") return false;
  if (campaign.startsAt && now < campaign.startsAt) return false;
  if (campaign.endsAt && now > campaign.endsAt) return false;
  if (campaign.remainingBudgetCoins < campaign.cpcCoins) return false;
  const spentToday =
    campaign.dailySpentOn && sameUtcDay(campaign.dailySpentOn, now) ? campaign.dailySpentCoins : 0n;
  if (spentToday + campaign.cpcCoins > campaign.dailyBudgetCoins) return false;
  return true;
}

export function matchesContext(campaign: SponsoredCandidate, context: AdContext): boolean {
  if (campaign.targetGameId && context.gameId && campaign.targetGameId !== context.gameId)
    return false;
  if (
    campaign.targetCategoryId &&
    context.categoryId &&
    campaign.targetCategoryId !== context.categoryId
  ) {
    return false;
  }
  if (campaign.targetPlatform && context.platform && campaign.targetPlatform !== context.platform)
    return false;
  if (campaign.targetRegion && context.region && campaign.targetRegion !== context.region)
    return false;
  return true;
}

export function underFrequencyCap(campaign: SponsoredCandidate): boolean {
  return campaign.impressionsForViewer < campaign.frequencyCap;
}

export function selectSponsoredAd(
  campaigns: readonly SponsoredCandidate[],
  context: AdContext,
): SponsoredCandidate | null {
  const eligible = campaigns.filter(
    (campaign) =>
      isCampaignBillable(campaign, context.now) &&
      matchesContext(campaign, context) &&
      underFrequencyCap(campaign),
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const aTime = a.lastShownAt?.getTime() ?? 0;
    const bTime = b.lastShownAt?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
  return eligible[0] ?? null;
}

export function isAdvertiserSelfClick(
  advertiserUserId: string,
  viewerUserId: string | null,
): boolean {
  return Boolean(viewerUserId && viewerUserId === advertiserUserId);
}
