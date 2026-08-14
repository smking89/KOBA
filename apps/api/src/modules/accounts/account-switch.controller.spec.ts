import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccountsModule } from './accounts.module';
import { AccountSwitchController } from './account-switch.controller';
import { KobaidModule } from '../kobaid/kobaid.module';
import { KobaidService } from '../kobaid/kobaid.service';
import { KobaIdRole } from '../kobaid/kobaid.types';

describe('AccountSwitchController', () => {
  let controller: AccountSwitchController;
  let kobaidService: KobaidService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [KobaidModule, AccountsModule],
    }).compile();

    controller = moduleRef.get(AccountSwitchController);
    kobaidService = moduleRef.get(KobaidService);
  });

  it('switches an existing role and returns capabilities + badge', async () => {
    await kobaidService.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' });

    const result = await controller.switchActiveRole({
      deviceId: 'device-1',
      role: KobaIdRole.PLAYER,
    });

    expect(result.kobaId.active).toBe(true);
    expect(result.capabilities.marketplaceBuy).toBe(true);
    expect(result.badge).toEqual({ showBadge: false });
  });

  it('rejects a request missing deviceId or role', async () => {
    await expect(controller.switchActiveRole({})).rejects.toThrow(BadRequestException);
    await expect(
      controller.switchActiveRole({ deviceId: 'device-1' }),
    ).rejects.toThrow(BadRequestException);
  });
});
