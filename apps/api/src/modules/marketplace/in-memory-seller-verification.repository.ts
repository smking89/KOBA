import { Injectable } from '@nestjs/common';
import { SellerVerificationRepository } from './seller-verification.repository';

@Injectable()
export class InMemorySellerVerificationRepository implements SellerVerificationRepository {
  private readonly verifiedSellerKobaIds = new Set<string>();

  async isVerifiedSeller(sellerKobaId: string): Promise<boolean> {
    return this.verifiedSellerKobaIds.has(sellerKobaId);
  }

  /** Test/dev helper — not part of the repository interface. */
  setVerified(sellerKobaId: string, verified: boolean): void {
    if (verified) {
      this.verifiedSellerKobaIds.add(sellerKobaId);
    } else {
      this.verifiedSellerKobaIds.delete(sellerKobaId);
    }
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.verifiedSellerKobaIds.clear();
  }
}
