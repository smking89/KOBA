import { KobaId } from '../kobaid/kobaid.types';
import { BadgeResult } from './badge.types';
import { CapabilityFlags } from './capability.types';
import { CommunityRole } from './community-role.types';

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
}
