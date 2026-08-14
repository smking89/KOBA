import { InMemoryKobaIdRepository } from '../kobaid/in-memory-kobaid.repository';
import { InMemoryStaffIssuanceLogRepository } from '../kobaid/in-memory-staff-issuance-log.repository';
import { KobaIdNotFoundForDeviceRoleError } from '../kobaid/kobaid.errors';
import { KobaidService } from '../kobaid/kobaid.service';
import { KobaIdRole } from '../kobaid/kobaid.types';
import { AccountSwitchService } from './account-switch.service';
import { CapabilityService } from './capability.service';
import { CommunityRole } from './community-role.types';

describe('AccountSwitchService', () => {
  let kobaidService: KobaidService;
  let repository: InMemoryKobaIdRepository;
  let service: AccountSwitchService;

  beforeEach(() => {
    repository = new InMemoryKobaIdRepository();
    kobaidService = new KobaidService(repository, new InMemoryStaffIssuanceLogRepository());
    service = new AccountSwitchService(kobaidService, new CapabilityService());
  });

  it('switches to a role the device already has and returns its capabilities', async () => {
    await kobaidService.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' });

    const result = await service.switchActiveRole({
      deviceId: 'device-1',
      role: KobaIdRole.PLAYER,
    });

    expect(result.kobaId.role).toBe(KobaIdRole.PLAYER);
    expect(result.kobaId.active).toBe(true);
    expect(result.capabilities.marketplaceBuy).toBe(true);
    expect(result.badge).toEqual({ showBadge: false });
  });

  it('includes badge resolution using the passed community role', async () => {
    await kobaidService.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' });

    const result = await service.switchActiveRole({
      deviceId: 'device-1',
      role: KobaIdRole.PLAYER,
      communityRole: CommunityRole.MODERATOR,
    });

    expect(result.badge).toEqual({ showBadge: true, badgeType: 'moderator' });
  });

  it('throws a typed error when switching to a role the device has not registered', async () => {
    await expect(
      service.switchActiveRole({ deviceId: 'device-1', role: KobaIdRole.BUSINESS }),
    ).rejects.toThrow(KobaIdNotFoundForDeviceRoleError);
  });

  it('deactivates the previously active KOBAID when switching to a different one', async () => {
    await kobaidService.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' });
    await kobaidService.mint({
      role: KobaIdRole.BUSINESS,
      deviceId: 'device-1',
      userId: 'user-1',
    });

    await service.switchActiveRole({ deviceId: 'device-1', role: KobaIdRole.PLAYER });
    const result = await service.switchActiveRole({
      deviceId: 'device-1',
      role: KobaIdRole.BUSINESS,
    });

    expect(result.kobaId.active).toBe(true);
    const player = await repository.findByDeviceAndRole('device-1', KobaIdRole.PLAYER);
    expect(player?.active).toBe(false);
  });

  it('does not mutate the KOBAID code/role/mintedAt when switching', async () => {
    const minted = await kobaidService.mint({
      role: KobaIdRole.PLAYER,
      deviceId: 'device-1',
      userId: 'user-1',
    });

    const result = await service.switchActiveRole({
      deviceId: 'device-1',
      role: KobaIdRole.PLAYER,
    });

    expect(result.kobaId.code).toBe(minted.code);
    expect(result.kobaId.role).toBe(minted.role);
    expect(result.kobaId.fullId).toBe(minted.fullId);
    expect(result.kobaId.mintedAt).toEqual(minted.mintedAt);
  });
});
