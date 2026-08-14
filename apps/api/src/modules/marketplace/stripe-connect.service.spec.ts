import { InMemoryStripeAccountRepository } from './in-memory-stripe-account.repository';
import { InvalidMoneyAmountError, StripeAccountNotActiveError } from './marketplace.errors';
import { StripeConnectService } from './stripe-connect.service';
import { StripeAccountStatus } from './stripe-connect.types';

describe('StripeConnectService', () => {
  let repository: InMemoryStripeAccountRepository;

  beforeEach(() => {
    repository = new InMemoryStripeAccountRepository();
  });

  describe('status tracking', () => {
    it('defaults to notConnected for an unknown seller', async () => {
      const service = new StripeConnectService(repository, 0.1);
      expect(await service.getStatus('KOBA-BZ-AAAA')).toBe(StripeAccountStatus.NOT_CONNECTED);
    });

    it('persists status changes', async () => {
      const service = new StripeConnectService(repository, 0.1);
      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.PENDING);
      expect(await service.getStatus('KOBA-BZ-AAAA')).toBe(StripeAccountStatus.PENDING);

      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.ACTIVE);
      expect(await service.getStatus('KOBA-BZ-AAAA')).toBe(StripeAccountStatus.ACTIVE);
    });
  });

  describe('assertSellerCanReceivePayouts', () => {
    it('does not throw when the seller is active', async () => {
      const service = new StripeConnectService(repository, 0.1);
      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.ACTIVE);
      await expect(service.assertSellerCanReceivePayouts('KOBA-BZ-AAAA')).resolves.toBeUndefined();
    });

    it('throws when the seller is notConnected', async () => {
      const service = new StripeConnectService(repository, 0.1);
      await expect(service.assertSellerCanReceivePayouts('KOBA-BZ-AAAA')).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });

    it('throws when the seller is pending', async () => {
      const service = new StripeConnectService(repository, 0.1);
      await service.setStatus('KOBA-BZ-AAAA', StripeAccountStatus.PENDING);
      await expect(service.assertSellerCanReceivePayouts('KOBA-BZ-AAAA')).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });
  });

  describe('calculateFee', () => {
    it('computes a 10% fee split', () => {
      const service = new StripeConnectService(repository, 0.1);
      expect(service.calculateFee(10_000)).toEqual({
        platformFeeCents: 1_000,
        sellerPayoutCents: 9_000,
      });
    });

    it('computes a 7.5% fee split, rounding the fee to the nearest cent', () => {
      const service = new StripeConnectService(repository, 0.075);
      // 4599 * 0.075 = 344.925 -> rounds to 345
      expect(service.calculateFee(4_599)).toEqual({
        platformFeeCents: 345,
        sellerPayoutCents: 4_254,
      });
    });

    it('computes a 0% fee split (rate is fully configurable)', () => {
      const service = new StripeConnectService(repository, 0);
      expect(service.calculateFee(2_500)).toEqual({
        platformFeeCents: 0,
        sellerPayoutCents: 2_500,
      });
    });

    it('rejects a non-integer amount', () => {
      const service = new StripeConnectService(repository, 0.1);
      expect(() => service.calculateFee(10.5)).toThrow(InvalidMoneyAmountError);
    });

    it('rejects a negative amount', () => {
      const service = new StripeConnectService(repository, 0.1);
      expect(() => service.calculateFee(-1)).toThrow(InvalidMoneyAmountError);
    });
  });
});
