import { InMemoryKobaIdRepository } from './in-memory-kobaid.repository';
import { InMemoryStaffIssuanceLogRepository } from './in-memory-staff-issuance-log.repository';
import {
  DuplicateKobaIdForDeviceRoleError,
  InvalidIssuerError,
  KobaIdCollisionRetryExhaustedError,
  KobaIdNotFoundForDeviceRoleError,
  StaffRoleRequiresAdminIssuanceError,
} from './kobaid.errors';
import { KobaIdRepository } from './kobaid.repository';
import { KobaidService } from './kobaid.service';
import { KobaId, KobaIdRole } from './kobaid.types';

describe('KobaidService', () => {
  let repository: InMemoryKobaIdRepository;
  let staffIssuanceLogRepository: InMemoryStaffIssuanceLogRepository;
  let service: KobaidService;

  beforeEach(() => {
    repository = new InMemoryKobaIdRepository();
    staffIssuanceLogRepository = new InMemoryStaffIssuanceLogRepository();
    service = new KobaidService(repository, staffIssuanceLogRepository);
  });

  describe('mint (community self-registration)', () => {
    it('mints a Player KOBAID with the expected format', async () => {
      const kobaId = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });

      expect(kobaId.fullId).toMatch(/^KOBA-PL-[2-9A-HJ-NP-Z]{4}$/);
      expect(kobaId.cosmeticOwnershipRefs).toEqual([]);
      expect(kobaId.issuedByKobaId).toBeNull();
    });

    it('rejects staff roles on the public mint path', async () => {
      await expect(
        service.mint({ role: KobaIdRole.SUPERADMIN, deviceId: 'device-1', userId: 'user-1' }),
      ).rejects.toThrow(StaffRoleRequiresAdminIssuanceError);
    });

    it('rejects a second KOBAID for the same device + role', async () => {
      await service.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' });

      await expect(
        service.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' }),
      ).rejects.toThrow(DuplicateKobaIdForDeviceRoleError);
    });

    it('allows one of each community role on the same device', async () => {
      const player = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });
      const business = await service.mint({
        role: KobaIdRole.BUSINESS,
        deviceId: 'device-1',
        userId: 'user-1',
      });
      const influencer = await service.mint({
        role: KobaIdRole.INFLUENCER,
        deviceId: 'device-1',
        userId: 'user-1',
      });

      expect(player.role).toBe(KobaIdRole.PLAYER);
      expect(business.role).toBe(KobaIdRole.BUSINESS);
      expect(influencer.role).toBe(KobaIdRole.INFLUENCER);
    });

    it('allows the same role on different devices', async () => {
      const first = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });
      const second = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-2',
        userId: 'user-2',
      });

      expect(first.deviceId).toBe('device-1');
      expect(second.deviceId).toBe('device-2');
      expect(first.fullId).not.toBe(second.fullId);
    });

    it('carries an optional referral code', async () => {
      const kobaId = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
        referralCode: 'PROMO123',
      });

      expect(kobaId.referralCode).toBe('PROMO123');
    });
  });

  describe('issueStaff (admin-issuance path)', () => {
    async function mintStaffIssuer(): Promise<KobaId> {
      // Bootstrap: directly save a staff KobaId to act as the issuer,
      // since staff KOBAIDs can only be created by an existing staff
      // member — the very first one has no predecessor in this test.
      const bootstrapIssuer: KobaId = {
        id: 'bootstrap-superadmin',
        role: KobaIdRole.SUPERADMIN,
        code: 'AAAA',
        fullId: 'KOBA-SA-AAAA',
        deviceId: 'bootstrap-device',
        userId: 'bootstrap-user',
        referralCode: null,
        cosmeticOwnershipRefs: [],
        issuedByKobaId: null,
        mintedAt: new Date(),
        active: false,
      };
      await repository.save(bootstrapIssuer);
      return bootstrapIssuer;
    }

    it('issues a staff KOBAID when the issuer is a valid staff KOBAID', async () => {
      const issuer = await mintStaffIssuer();

      const moderator = await service.issueStaff({
        role: KobaIdRole.MODERATOR,
        deviceId: 'staff-device-1',
        userId: 'staff-user-1',
        issuedByKobaId: issuer.id,
      });

      expect(moderator.role).toBe(KobaIdRole.MODERATOR);
      expect(moderator.issuedByKobaId).toBe(issuer.id);
    });

    it('rejects issuance when the issuer does not exist', async () => {
      await expect(
        service.issueStaff({
          role: KobaIdRole.MODERATOR,
          deviceId: 'staff-device-1',
          userId: 'staff-user-1',
          issuedByKobaId: 'does-not-exist',
        }),
      ).rejects.toThrow(InvalidIssuerError);
    });

    it('rejects issuance when the issuer is not staff', async () => {
      const player = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });

      await expect(
        service.issueStaff({
          role: KobaIdRole.MODERATOR,
          deviceId: 'staff-device-1',
          userId: 'staff-user-1',
          issuedByKobaId: player.id,
        }),
      ).rejects.toThrow(InvalidIssuerError);
    });

    it('community roles cannot be minted through the staff issuance path', async () => {
      const issuer = await mintStaffIssuer();

      await expect(
        service.issueStaff({
          role: KobaIdRole.PLAYER,
          deviceId: 'device-1',
          userId: 'user-1',
          issuedByKobaId: issuer.id,
        }),
      ).rejects.toThrow();
    });
  });

  describe('collision handling', () => {
    it('regenerates the code on collision instead of failing the caller', async () => {
      const repo: KobaIdRepository = repository;
      let lookups = 0;
      const originalFindByCode = repo.findByCode.bind(repo);
      jest.spyOn(repo, 'findByCode').mockImplementation(async (code: string) => {
        lookups++;
        // Force the first two lookups to report a collision, then behave normally.
        if (lookups <= 2) {
          return { code } as KobaId;
        }
        return originalFindByCode(code);
      });

      const kobaId = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });

      expect(lookups).toBeGreaterThan(2);
      expect(kobaId.code).toBeDefined();
    });

    it('throws a typed error when retries are exhausted', async () => {
      jest.spyOn(repository, 'findByCode').mockResolvedValue({ code: 'AAAA' } as KobaId);

      await expect(
        service.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' }),
      ).rejects.toThrow(KobaIdCollisionRetryExhaustedError);
    });
  });

  describe('staff-issuance audit log', () => {
    async function mintStaffIssuer(id = 'bootstrap-superadmin'): Promise<KobaId> {
      const bootstrapIssuer: KobaId = {
        id,
        role: KobaIdRole.SUPERADMIN,
        code: 'AAAA',
        fullId: 'KOBA-SA-AAAA',
        deviceId: `${id}-device`,
        userId: `${id}-user`,
        referralCode: null,
        cosmeticOwnershipRefs: [],
        issuedByKobaId: null,
        mintedAt: new Date(),
        active: false,
      };
      await repository.save(bootstrapIssuer);
      return bootstrapIssuer;
    }

    it('records a log entry on successful issuance', async () => {
      const issuer = await mintStaffIssuer();

      const moderator = await service.issueStaff({
        role: KobaIdRole.MODERATOR,
        deviceId: 'staff-device-1',
        userId: 'staff-user-1',
        issuedByKobaId: issuer.id,
      });

      const log = await service.getStaffIssuanceLog();
      expect(log).toHaveLength(1);
      expect(log[0].issuerKobaId).toBe(issuer.id);
      expect(log[0].issuedKobaId).toBe(moderator.id);
      expect(log[0].targetRole).toBe(KobaIdRole.MODERATOR);
      expect(log[0].issuedAt).toBeInstanceOf(Date);
    });

    it('does not record a log entry when issuance fails', async () => {
      // No valid issuer exists, so this call throws before persisting.
      await expect(
        service.issueStaff({
          role: KobaIdRole.MODERATOR,
          deviceId: 'staff-device-1',
          userId: 'staff-user-1',
          issuedByKobaId: 'does-not-exist',
        }),
      ).rejects.toThrow(InvalidIssuerError);

      expect(await service.getStaffIssuanceLog()).toEqual([]);
    });

    it('does not record a log entry when persistence fails after a valid issuer', async () => {
      const issuer = await mintStaffIssuer();
      await service.issueStaff({
        role: KobaIdRole.MODERATOR,
        deviceId: 'staff-device-1',
        userId: 'staff-user-1',
        issuedByKobaId: issuer.id,
      });

      // Second issuance to the same device+role collides and throws.
      await expect(
        service.issueStaff({
          role: KobaIdRole.MODERATOR,
          deviceId: 'staff-device-1',
          userId: 'staff-user-1',
          issuedByKobaId: issuer.id,
        }),
      ).rejects.toThrow(DuplicateKobaIdForDeviceRoleError);

      expect(await service.getStaffIssuanceLog()).toHaveLength(1);
    });

    it('findByIssuer returns only entries created by that issuer', async () => {
      const issuerA = await mintStaffIssuer('issuer-a');
      const issuerB = await mintStaffIssuer('issuer-b');

      const modA = await service.issueStaff({
        role: KobaIdRole.MODERATOR,
        deviceId: 'device-a',
        userId: 'user-a',
        issuedByKobaId: issuerA.id,
      });
      await service.issueStaff({
        role: KobaIdRole.ADMIN,
        deviceId: 'device-b',
        userId: 'user-b',
        issuedByKobaId: issuerB.id,
      });

      const entriesForA = await service.getStaffIssuanceLogByIssuer(issuerA.id);
      expect(entriesForA).toHaveLength(1);
      expect(entriesForA[0].issuedKobaId).toBe(modA.id);
      expect(entriesForA[0].issuerKobaId).toBe(issuerA.id);
    });
  });

  describe('activateForDevice (switching)', () => {
    it('activates the target KOBAID and returns it', async () => {
      const player = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });
      expect(player.active).toBe(false);

      const activated = await service.activateForDevice('device-1', KobaIdRole.PLAYER);

      expect(activated.active).toBe(true);
      expect(activated.id).toBe(player.id);
    });

    it('throws a typed error when the device has no KOBAID for the role', async () => {
      await expect(
        service.activateForDevice('device-1', KobaIdRole.BUSINESS),
      ).rejects.toThrow(KobaIdNotFoundForDeviceRoleError);
    });

    it('deactivates the previously active KOBAID on the same device', async () => {
      await service.mint({ role: KobaIdRole.PLAYER, deviceId: 'device-1', userId: 'user-1' });
      await service.mint({ role: KobaIdRole.BUSINESS, deviceId: 'device-1', userId: 'user-1' });

      const player = await service.activateForDevice('device-1', KobaIdRole.PLAYER);
      expect(player.active).toBe(true);

      const business = await service.activateForDevice('device-1', KobaIdRole.BUSINESS);
      expect(business.active).toBe(true);

      const playerAfter = await repository.findByDeviceAndRole('device-1', KobaIdRole.PLAYER);
      expect(playerAfter?.active).toBe(false);
    });

    it('does not mutate code/role/mintedAt when activating', async () => {
      const player = await service.mint({
        role: KobaIdRole.PLAYER,
        deviceId: 'device-1',
        userId: 'user-1',
      });

      const activated = await service.activateForDevice('device-1', KobaIdRole.PLAYER);

      expect(activated.code).toBe(player.code);
      expect(activated.role).toBe(player.role);
      expect(activated.fullId).toBe(player.fullId);
      expect(activated.mintedAt).toEqual(player.mintedAt);
    });
  });
});
