import { Injectable } from '@nestjs/common';
import { KobaidService } from '../kobaid/kobaid.service';
import { resolveBadgeForKobaId } from './badge.resolver';
import { CapabilityService } from './capability.service';
import { SwitchActiveRoleParams, SwitchActiveRoleResult } from './account-switch.types';
import { TaggingPermissionService } from './tagging-permission.service';

/**
 * Phase 2 (Account Switching Flow): switches which of a device's existing
 * KOBAIDs is active, and resolves everything a caller needs to react to
 * that switch (capabilities — including the Phase 7 `adsPaused` flag —
 * badge, and Phase 2/6 tagging-permission rules) from the single source
 * of truth each already lives in.
 *
 * Explicitly NOT in scope here (still TODO — see accounts/README.md):
 * - The switching UI itself.
 * - Tag enforcement/rendering (Phase 6) — only the permission rules are
 *   resolved and returned here.
 * - The ads module itself (Phase 7) — only the `adsPaused` flag is wired
 *   through `capabilities`.
 */
@Injectable()
export class AccountSwitchService {
  constructor(
    private readonly kobaidService: KobaidService,
    private readonly capabilityService: CapabilityService,
    private readonly taggingPermissionService: TaggingPermissionService,
  ) {}

  async switchActiveRole(params: SwitchActiveRoleParams): Promise<SwitchActiveRoleResult> {
    // activateForDevice() never mints — it throws KobaIdNotFoundForDeviceRoleError
    // if the device has no KOBAID for `role` yet, and never mutates the
    // KOBAID's code/role/mintedAt (see kobaid.service.ts).
    const kobaId = await this.kobaidService.activateForDevice(params.deviceId, params.role);
    const capabilities = this.capabilityService.resolve(params.role);
    const badge = resolveBadgeForKobaId(kobaId, params.communityRole);
    const tagging = this.taggingPermissionService.resolve(params.role);

    return { kobaId, capabilities, badge, tagging };
  }
}
