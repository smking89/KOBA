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
};
