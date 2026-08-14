import { InMemoryKobaIdRepository } from './in-memory-kobaid.repository';
import {
  DuplicateKobaIdForDeviceRoleError,
  InvalidIssuerError,
  KobaIdCollisionRetryExhaustedError,
  StaffRoleRequiresAdminIssuanceError,
} from './kobaid.errors';
import { KobaIdRepository } from './kobaid.repository';
import { KobaidService } from './kobaid.service';
import { KobaId, KobaIdRole } from './kobaid.types';

describe('KobaidService', () => {
  let repository: InMemoryKobaIdRepository;
  let service: KobaidService;

  beforeEach(() => {
    repository = new InMemoryKobaIdRepository();
    service = new KobaidService(repository);
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
});
