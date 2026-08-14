/**
 * Typed capability-flag set. Read by Phase 2's account switching UI and
 * Phase 11's RBAC — both should read from CapabilityService rather than
 * hardcoding role checks.
 */
export interface CapabilityFlags {
  marketplaceBuy: boolean;
  marketplaceBid: boolean;
  groupsLfgDmsFeed: boolean;
  cosmeticInventory: boolean;
  shopTools: boolean;
  productUploads: boolean;
  adsCreation: boolean;
  devPortalAccess: boolean;
  promoPage: boolean;
  referralCodeManagement: boolean;
  earningsDashboard: boolean;
  /**
   * Phase 7 (KOBA Ads) flag, wired through here so it has somewhere to
   * attach ahead of the ads module existing: true while the active role
   * is Player, false for Business/Influencer. The ads module itself
   * isn't built yet — this is just the mode-to-pause mapping.
   */
  adsPaused: boolean;
}

export const NO_CAPABILITIES: CapabilityFlags = {
  marketplaceBuy: false,
  marketplaceBid: false,
  groupsLfgDmsFeed: false,
  cosmeticInventory: false,
  shopTools: false,
  productUploads: false,
  adsCreation: false,
  devPortalAccess: false,
  promoPage: false,
  referralCodeManagement: false,
  earningsDashboard: false,
  adsPaused: false,
};
