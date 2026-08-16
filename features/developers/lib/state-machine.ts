import type { DevReviewState } from "@/features/developer-portal/lib/types";

const PRODUCT: Record<string, readonly string[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED", "SECURITY_REVIEW"],
  SECURITY_REVIEW: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: ["SUBMITTED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "SUSPENDED", "ARCHIVED"],
  PUBLISHED: ["SUSPENDED", "ARCHIVED"],
  REJECTED: ["SUBMITTED", "ARCHIVED"],
  SUSPENDED: ["PUBLISHED", "ARCHIVED", "REJECTED"],
  ARCHIVED: [],
  REVOKED: [],
};

export function canTransitionDevProduct(from: DevReviewState, to: DevReviewState): boolean {
  return (PRODUCT[from] ?? []).includes(to);
}

export function assertDevProductTransition(from: DevReviewState, to: DevReviewState): void {
  if (!canTransitionDevProduct(from, to)) {
    throw new Error(`Invalid developer product transition ${from} → ${to}`);
  }
}

export function isPublicDevState(state: DevReviewState): boolean {
  return state === "PUBLISHED";
}
