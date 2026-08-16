export const AFFILIATE_CAMPAIGN_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "REJECTED",
  "SUSPENDED",
  "CANCELLED",
] as const;
export type AffiliateCampaignStatus = (typeof AFFILIATE_CAMPAIGN_STATUSES)[number];

const TRANSITIONS: Record<AffiliateCampaignStatus, readonly AffiliateCampaignStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "SUSPENDED", "CANCELLED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED", "SUSPENDED"],
  COMPLETED: [],
  REJECTED: ["DRAFT"],
  SUSPENDED: ["PAUSED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionCampaign(
  from: AffiliateCampaignStatus,
  to: AffiliateCampaignStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function campaignIsAttributable(
  status: AffiliateCampaignStatus,
  now: Date,
  startsAt: Date | null,
  endsAt: Date | null,
): boolean {
  if (status !== "ACTIVE") return false;
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
}

export const PARTICIPATION_STATUSES = [
  "INVITED",
  "APPLIED",
  "ACTIVE",
  "REJECTED",
  "PAUSED",
  "REVOKED",
  "COMPLETED",
] as const;
export type CampaignParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

const PARTICIPATION_TRANSITIONS: Record<
  CampaignParticipationStatus,
  readonly CampaignParticipationStatus[]
> = {
  INVITED: ["ACTIVE", "REJECTED", "REVOKED"],
  APPLIED: ["ACTIVE", "REJECTED", "REVOKED"],
  ACTIVE: ["PAUSED", "REVOKED", "COMPLETED"],
  REJECTED: [],
  PAUSED: ["ACTIVE", "REVOKED", "COMPLETED"],
  REVOKED: [],
  COMPLETED: [],
};

export function canTransitionParticipation(
  from: CampaignParticipationStatus,
  to: CampaignParticipationStatus,
): boolean {
  return PARTICIPATION_TRANSITIONS[from].includes(to);
}

export function participationIsAttributable(status: CampaignParticipationStatus): boolean {
  return status === "ACTIVE";
}
