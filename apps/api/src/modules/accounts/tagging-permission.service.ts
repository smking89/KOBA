import { Injectable } from '@nestjs/common';
import { KobaIdRole, isStaffRole } from '../kobaid/kobaid.types';
import { TaggingPermissionsNotDefinedForStaffRoleError } from './accounts.errors';
import { NO_TAGGING_PERMISSIONS, TaggingPermissions } from './tagging-permission.types';

const PLAYER_TAGGING: TaggingPermissions = {
  ...NO_TAGGING_PERMISSIONS,
  canTagAsPlayer: true,
};

const BUSINESS_TAGGING: TaggingPermissions = {
  ...PLAYER_TAGGING,
  canTagShopProducts: true,
};

const INFLUENCER_TAGGING: TaggingPermissions = {
  ...PLAYER_TAGGING,
  canTagPromo: true,
};

/**
 * Resolves tagging *permission rules* per role — ROADMAP.md's Phase 2
 * "tagging permission changes per mode" deliverable. Pure/deterministic —
 * no I/O — mirroring CapabilityService. Phase 6 (Social Layer) is what
 * actually enforces these against a real `TagAction`/@mention model; this
 * only needs to exist and be queryable, wired into the same account-switch
 * response as capabilities/badge so switching to Player mode disables
 * business/influencer tagging capabilities (ROADMAP Phase 6) automatically.
 */
@Injectable()
export class TaggingPermissionService {
  resolve(role: KobaIdRole): TaggingPermissions {
    if (isStaffRole(role)) {
      // Staff tagging rules aren't part of the Player/Business/Influencer
      // model this phase defines — fail loudly rather than guessing.
      throw new TaggingPermissionsNotDefinedForStaffRoleError(role);
    }

    switch (role) {
      case KobaIdRole.PLAYER:
        return PLAYER_TAGGING;
      case KobaIdRole.BUSINESS:
        return BUSINESS_TAGGING;
      case KobaIdRole.INFLUENCER:
        return INFLUENCER_TAGGING;
      default:
        return NO_TAGGING_PERMISSIONS;
    }
  }
}
