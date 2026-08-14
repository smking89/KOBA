import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { KobaIdRole } from '../kobaid/kobaid.types';
import { AccountSwitchService } from './account-switch.service';
import { SwitchActiveRoleResult } from './account-switch.types';
import { CommunityRole } from './community-role.types';

interface SwitchActiveRoleRequestBody {
  deviceId?: string;
  role?: KobaIdRole;
  communityRole?: CommunityRole;
}

/**
 * Thin HTTP layer over AccountSwitchService — Phase 2's account-switching
 * endpoint, pulled forward per this pass's task scope. Everything else
 * Phase 2 needs (settings UI, tag-permission enforcement, ad-pausing) is
 * still TODO, see accounts/README.md.
 */
@Controller('accounts')
export class AccountSwitchController {
  constructor(private readonly accountSwitchService: AccountSwitchService) {}

  @Post('switch')
  async switchActiveRole(
    @Body() body: SwitchActiveRoleRequestBody,
  ): Promise<SwitchActiveRoleResult> {
    if (!body?.deviceId || !body?.role) {
      throw new BadRequestException('"deviceId" and "role" are required');
    }

    return this.accountSwitchService.switchActiveRole({
      deviceId: body.deviceId,
      role: body.role,
      communityRole: body.communityRole,
    });
  }
}
