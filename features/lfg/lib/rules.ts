import { GAME_PLATFORMS, type GamePlatform } from "@/features/marketplace/lib/catalog";

export const LFG_REGIONS = ["NA", "EU", "SA", "AS", "OC", "AF", "ANY"] as const;
export type LfgRegion = (typeof LFG_REGIONS)[number];

export const LFG_SKILLS = ["CASUAL", "INTERMEDIATE", "COMPETITIVE", "ANY"] as const;
export type LfgSkill = (typeof LFG_SKILLS)[number];

export const LFG_MIC = ["REQUIRED", "OPTIONAL", "NO_MIC"] as const;
export type LfgMic = (typeof LFG_MIC)[number];

export const LFG_STATUSES = ["OPEN", "FULL", "EXPIRED", "CANCELLED"] as const;
export type LfgStatus = (typeof LFG_STATUSES)[number];

export const LFG_REGION_LABEL: Record<LfgRegion, string> = {
  NA: "North America",
  EU: "Europe",
  SA: "South America",
  AS: "Asia",
  OC: "Oceania",
  AF: "Africa",
  ANY: "Any region",
};

export const LFG_SKILL_LABEL: Record<LfgSkill, string> = {
  CASUAL: "Casual",
  INTERMEDIATE: "Intermediate",
  COMPETITIVE: "Competitive",
  ANY: "Any skill",
};

export const LFG_MIC_LABEL: Record<LfgMic, string> = {
  REQUIRED: "Mic required",
  OPTIONAL: "Mic optional",
  NO_MIC: "No mic",
};

export { GAME_PLATFORMS };
export type { GamePlatform };

export function resolveLfgStatus(input: {
  status: LfgStatus;
  expiresAt: Date;
  slotsFilled: number;
  slotsTotal: number;
  now: Date;
}): LfgStatus {
  if (input.status === "CANCELLED") {
    return "CANCELLED";
  }
  if (input.now >= input.expiresAt) {
    return "EXPIRED";
  }
  if (input.status === "FULL" || input.slotsFilled >= input.slotsTotal) {
    return "FULL";
  }
  return "OPEN";
}

export function canRequestLfgSeat(input: {
  viewerUserId: string;
  authorUserId: string;
  status: LfgStatus;
  alreadyRequested: boolean;
}): boolean {
  return (
    input.status === "OPEN" && input.viewerUserId !== input.authorUserId && !input.alreadyRequested
  );
}

export function canAcceptLfgRequest(input: {
  actorUserId: string;
  authorUserId: string;
  status: LfgStatus;
  requestStatus: string;
}): boolean {
  return (
    input.actorUserId === input.authorUserId &&
    input.status === "OPEN" &&
    input.requestStatus === "PENDING"
  );
}

export function nextFilledCount(
  slotsFilled: number,
  slotsTotal: number,
): {
  slotsFilled: number;
  status: "OPEN" | "FULL";
} {
  const next = Math.min(slotsFilled + 1, slotsTotal);
  return { slotsFilled: next, status: next >= slotsTotal ? "FULL" : "OPEN" };
}
