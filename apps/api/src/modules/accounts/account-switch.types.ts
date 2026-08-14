import { KobaId } from '../kobaid/kobaid.types';
import { BadgeResult } from './badge.types';
import { CapabilityFlags } from './capability.types';
import { CommunityRole } from './community-role.types';
import { TaggingPermissions } from './tagging-permission.types';

export interface SwitchActiveRoleParams {
  deviceId: string;
  role: KobaId['role'];
  /**
   * Optional community role (Group/Shop Admin/Moderator) held by the
   * target KOBAID, purely for badge resolution — not stored/looked up
   * here since there's no Groups module yet (Phase 5).
   */
  communityRole?: CommunityRole;
}

export interface SwitchActiveRoleResult {
  kobaId: KobaId;
  capabilities: CapabilityFlags;
  badge: BadgeResult;
  /**
   * Tagging permission rules for the newly-active role (ROADMAP.md Phase 2
   * "tagging permission changes per mode" deliverable) — rule mapping
   * only, actual tag enforcement/rendering is Phase 6.
   */
  tagging: TaggingPermissions;
}
