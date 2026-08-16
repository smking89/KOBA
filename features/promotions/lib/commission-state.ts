export const COMMISSION_STATUSES = [
  "PENDING",
  "QUALIFIED",
  "AVAILABLE",
  "REVERSED",
  "PAID",
  "CANCELLED",
  "UNDER_REVIEW",
] as const;
export type PromotionCommissionStatus = (typeof COMMISSION_STATUSES)[number];

const TRANSITIONS: Record<PromotionCommissionStatus, readonly PromotionCommissionStatus[]> = {
  PENDING: ["QUALIFIED", "REVERSED", "CANCELLED", "UNDER_REVIEW"],
  QUALIFIED: ["AVAILABLE", "REVERSED", "UNDER_REVIEW", "CANCELLED"],
  AVAILABLE: ["PAID", "REVERSED", "UNDER_REVIEW"],
  UNDER_REVIEW: ["QUALIFIED", "REVERSED", "CANCELLED", "AVAILABLE"],
  REVERSED: [],
  PAID: ["REVERSED"],
  CANCELLED: [],
};

export function canTransitionCommission(
  from: PromotionCommissionStatus,
  to: PromotionCommissionStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function commissionHoldHours(): number {
  const parsed = Number.parseInt(process.env.KOBA_COMMISSION_HOLD_HOURS ?? "72", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 72;
}

export function isPastHold(createdAt: Date, now: Date, holdHours = commissionHoldHours()): boolean {
  return now.getTime() - createdAt.getTime() >= holdHours * 60 * 60 * 1000;
}

export function refundCommissionStatus(
  status: PromotionCommissionStatus,
): PromotionCommissionStatus | null {
  if (status === "REVERSED" || status === "CANCELLED") return null;
  return "REVERSED";
}
