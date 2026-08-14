import { Injectable } from '@nestjs/common';
import { StripeAccountRepository } from './stripe-account.repository';
import { StripeAccountStatus } from './stripe-connect.types';

@Injectable()
export class InMemoryStripeAccountRepository implements StripeAccountRepository {
  private readonly statusBySellerKobaId = new Map<string, StripeAccountStatus>();

  async getStatus(sellerKobaId: string): Promise<StripeAccountStatus> {
    return this.statusBySellerKobaId.get(sellerKobaId) ?? StripeAccountStatus.NOT_CONNECTED;
  }

  async setStatus(sellerKobaId: string, status: StripeAccountStatus): Promise<void> {
    this.statusBySellerKobaId.set(sellerKobaId, status);
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.statusBySellerKobaId.clear();
  }
}
