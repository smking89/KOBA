import { InMemorySellerVerificationRepository } from './in-memory-seller-verification.repository';
import { InMemoryStripeAccountRepository } from './in-memory-stripe-account.repository';
import { InvalidMoneyAmountError, StripeAccountNotActiveError } from './marketplace.errors';
import { StripeConnectService } from './stripe-connect.service';
import { PlatformFeeRateSchedule, StripeAccountStatus } from './stripe-connect.types';

describe('StripeConnectService', () => {
  let repository: InMemoryStripeAccountRepository;
  let sellerVerificationRepository: InMemorySellerVerificationRepository;

  // Real rate schedule per roadmap/platform-fee-research.md §2: 8% standard,
  // 4% for Blue-Badge-verified shops.
  const REAL_RATE_SCHEDULE: PlatformFeeRateSchedule = { standardRate: 0.08, verifiedRate: 0.04 };

  function makeService(rateSchedule: PlatformFeeRateSchedule = REAL_RATE_SCHEDULE): StripeConnectService {
    return new StripeConnectService(repository, rateSchedule, sellerVerificationRepository);
  }

  beforeEach(() => {
    repository = new InMemoryStripeAccountRepository();
    sellerVerificationRepository = new InMemorySellerVerificationRepository();
  });

  describe('status tracking', () => {
    it('defaults to notConnected for an unknown seller', async () => {
      const service = makeService();
      expect(await service.getStatus('KOBA-BZ-AAAA')).toBe(StripeAccountStatus.NOT_CONNECTED);
    });

    it('persists status changes', async () => {
      const service = makeService();
      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.PENDING);
      expect(await service.getStatus('KOBA-BZ-AAAA')).toBe(StripeAccountStatus.PENDING);

      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.ACTIVE);
      expect(await service.getStatus('KOBA-BZ-AAAA')).toBe(StripeAccountStatus.ACTIVE);
    });
  });

  describe('assertSellerCanReceivePayouts', () => {
    it('does not throw when the seller is active', async () => {
      const service = makeService();
      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.ACTIVE);
      await expect(service.assertSellerCanReceivePayouts('KOBA-BZ-AAAA')).resolves.toBeUndefined();
    });

    it('throws when the seller is notConnected', async () => {
      const service = makeService();
      await expect(service.assertSellerCanReceivePayouts('KOBA-BZ-AAAA')).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });

    it('throws when the seller is pending', async () => {
      const service = makeService();
      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.PENDING);
      await expect(service.assertSellerCanReceivePayouts('KOBA-BZ-AAAA')).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });
  });

  describe('calculateFee', () => {
    it('computes the 8% standard-rate fee split for an unverified seller', () => {
      const service = makeService();
      // 10_000 * 0.08 = 800
      expect(service.calculateFee(10_000, false)).toEqual({
        platformFeeCents: 800,
        sellerPayoutCents: 9_200,
      });
    });

    it('computes the 4% verified-rate fee split for a Blue-Badge-verified seller', () => {
      const service = makeService();
      // 10_000 * 0.04 = 400
      expect(service.calculateFee(10_000, true)).toEqual({
        platformFeeCents: 400,
        sellerPayoutCents: 9_600,
      });
    });

    it('rounds the standard-rate fee to the nearest cent', () => {
      const service = makeService();
      // 4599 * 0.08 = 367.92 -> rounds to 368
      expect(service.calculateFee(4_599, false)).toEqual({
        platformFeeCents: 368,
        sellerPayoutCents: 4_231,
      });
    });

    it('rounds the verified-rate fee to the nearest cent', () => {
      const service = makeService();
      // 4599 * 0.04 = 183.96 -> rounds to 184
      expect(service.calculateFee(4_599, true)).toEqual({
        platformFeeCents: 184,
        sellerPayoutCents: 4_415,
      });
    });

    it('computes a 0% fee split when both rates are configured to 0 (rate schedule is fully configurable)', () => {
      const service = makeService({ standardRate: 0, verifiedRate: 0 });
      expect(service.calculateFee(2_500, false)).toEqual({
        platformFeeCents: 0,
        sellerPayoutCents: 2_500,
      });
    });

    it('rejects a non-integer amount', () => {
      const service = makeService();
      expect(() => service.calculateFee(10.5, false)).toThrow(InvalidMoneyAmountError);
    });

    it('rejects a negative amount', () => {
      const service = makeService();
      expect(() => service.calculateFee(-1, false)).toThrow(InvalidMoneyAmountError);
    });
  });

  describe('calculateFeeForSeller (verification status resolved at settlement time)', () => {
    const SELLER = 'KOBA-BZ-AAAA';

    it('charges the 8% standard rate when the seller has never been verified', async () => {
      const service = makeService();
      await expect(service.calculateFeeForSeller(SELLER, 10_000)).resolves.toEqual({
        platformFeeCents: 800,
        sellerPayoutCents: 9_200,
      });
    });

    it('charges the 4% verified rate when the seller is currently Blue-Badge-verified', async () => {
      sellerVerificationRepository.setVerified(SELLER, true);
      const service = makeService();
      await expect(service.calculateFeeForSeller(SELLER, 10_000)).resolves.toEqual({
        platformFeeCents: 400,
        sellerPayoutCents: 9_600,
      });
    });

    it('reflects verification status AT SETTLEMENT TIME, not a value cached earlier at checkout — ' +
      'seller becomes verified between order creation and settlement', async () => {
      const service = makeService();

      // "Checkout time": seller is not yet verified.
      expect(await sellerVerificationRepository.isVerifiedSeller(SELLER)).toBe(false);

      // Blue Badge is granted mid-cycle, before settlement runs.
      sellerVerificationRepository.setVerified(SELLER, true);

      // "Settlement time": the fee must reflect the *current* status, i.e. verified/4%.
      await expect(service.calculateFeeForSeller(SELLER, 10_000)).resolves.toEqual({
        platformFeeCents: 400,
        sellerPayoutCents: 9_600,
      });
    });

    it('reflects verification status AT SETTLEMENT TIME when the seller LOSES verification ' +
      'between order creation and settlement', async () => {
      sellerVerificationRepository.setVerified(SELLER, true);
      const service = makeService();

      // Blue Badge is revoked mid-cycle, before settlement runs.
      sellerVerificationRepository.setVerified(SELLER, false);

      // Settlement must charge the standard 8% rate, not the verified rate
      // that would have applied at checkout time.
      await expect(service.calculateFeeForSeller(SELLER, 10_000)).resolves.toEqual({
        platformFeeCents: 800,
        sellerPayoutCents: 9_200,
      });
    });
  });
});
