export type AttributionCandidate = {
  participationId: string;
  campaignId: string;
  influencerUserId: string;
  sellerUserId: string;
  clickedAt: Date;
  windowHours: number;
  source: "CLICK" | "PROMO_CODE";
};

export function isWithinAttributionWindow(
  clickedAt: Date,
  now: Date,
  windowHours: number,
): boolean {
  return now.getTime() - clickedAt.getTime() <= windowHours * 60 * 60 * 1000 && clickedAt <= now;
}

export function isSelfReferral(input: {
  buyerUserId: string;
  influencerUserId: string;
  sellerUserId: string;
}): boolean {
  return (
    input.buyerUserId === input.influencerUserId || input.influencerUserId === input.sellerUserId
  );
}

/**
 * Last eligible click wins. A valid promo-code attribution overrides click
 * attribution when both exist for the same checkout.
 */
export function chooseAttribution(input: {
  click: AttributionCandidate | null;
  promo: AttributionCandidate | null;
  buyerUserId: string;
  now: Date;
  checkoutStartedAt: Date;
}): AttributionCandidate | null {
  const eligible = (candidate: AttributionCandidate | null) => {
    if (!candidate) return null;
    if (
      isSelfReferral({
        buyerUserId: input.buyerUserId,
        influencerUserId: candidate.influencerUserId,
        sellerUserId: candidate.sellerUserId,
      })
    ) {
      return null;
    }
    if (candidate.clickedAt > input.checkoutStartedAt) return null;
    if (!isWithinAttributionWindow(candidate.clickedAt, input.now, candidate.windowHours)) {
      return null;
    }
    return candidate;
  };
  return eligible(input.promo) ?? eligible(input.click);
}
