import { Injectable } from '@nestjs/common';
import { KobaidService } from '../kobaid/kobaid.service';
import { resolveBadgeForKobaId } from './badge.resolver';
import { CapabilityService } from './capability.service';
import { SwitchActiveRoleParams, SwitchActiveRoleResult } from './account-switch.types';

/**
 * Phase 2 (Account Switching Flow), pulled forward per this pass's task
 * scope: switches which of a device's existing KOBAIDs is active.
 *
 * Explicitly NOT in scope here (still TODO — see accounts/README.md):
 * - The switching UI itself.
 * - Tag-permission enforcement on switch (Phase 6).
 * - Pausing ads in Player mode (Phase 7).
 */
@Injectable()
export class AccountSwitchService {
  constructor(
    private readonly kobaidService: KobaidService,
    private readonly capabilityService: CapabilityService,
  ) {}

  async switchActiveRole(params: SwitchActiveRoleParams): Promise<SwitchActiveRoleResult> {
    // activateForDevice() never mints — it throws KobaIdNotFoundForDeviceRoleError
    // if the device has no KOBAID for `role` yet, and never mutates the
    // KOBAID's code/role/mintedAt (see kobaid.service.ts).
    const kobaId = await this.kobaidService.activateForDevice(params.deviceId, params.role);
    const capabilities = this.capabilityService.resolve(params.role);
    const badge = resolveBadgeForKobaId(kobaId, params.communityRole);

    return { kobaId, capabilities, badge };
  }
}
