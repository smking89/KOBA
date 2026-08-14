import { Injectable } from '@nestjs/common';
import { KobaIdRole, isStaffRole } from '../kobaid/kobaid.types';
import { CapabilitiesNotDefinedForStaffRoleError } from './accounts.errors';
import { CapabilityFlags, NO_CAPABILITIES } from './capability.types';

const PLAYER_CAPABILITIES: CapabilityFlags = {
  ...NO_CAPABILITIES,
  marketplaceBuy: true,
  marketplaceBid: true,
  groupsLfgDmsFeed: true,
  cosmeticInventory: true,
};

const BUSINESS_CAPABILITIES: CapabilityFlags = {
  ...PLAYER_CAPABILITIES,
  shopTools: true,
  productUploads: true,
  adsCreation: true,
  devPortalAccess: true,
};

const INFLUENCER_CAPABILITIES: CapabilityFlags = {
  ...NO_CAPABILITIES,
  promoPage: true,
  referralCodeManagement: true,
  earningsDashboard: true,
};

/**
 * Resolves capability flags per role. Pure/deterministic — no I/O — so
 * Phase 2 (switching) and Phase 11 (RBAC) can both call it without a
 * database round-trip.
 */
@Injectable()
export class CapabilityService {
  resolve(role: KobaIdRole): CapabilityFlags {
    if (isStaffRole(role)) {
      // Staff (SA/AD/MD) capability/permission definitions belong to
      // Phase 11 (Role System / RBAC), not Phase 1's community/business/
      // influencer capability model. Fail loudly rather than silently
      // returning an empty or wrong flag set.
      throw new CapabilitiesNotDefinedForStaffRoleError(role);
    }

    switch (role) {
      case KobaIdRole.PLAYER:
        return PLAYER_CAPABILITIES;
      case KobaIdRole.BUSINESS:
        return BUSINESS_CAPABILITIES;
      case KobaIdRole.INFLUENCER:
        return INFLUENCER_CAPABILITIES;
      default:
        return NO_CAPABILITIES;
    }
  }
}
