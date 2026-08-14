import { Module } from '@nestjs/common';
import { AUCTION_REPOSITORY } from './auction.repository';
import { AuctionService } from './auction.service';
import { InMemoryAuctionRepository } from './in-memory-auction.repository';
import { InMemoryOrderRepository } from './in-memory-order.repository';
import { InMemoryProductRepository } from './in-memory-product.repository';
import { InMemorySellerVerificationRepository } from './in-memory-seller-verification.repository';
import { InMemoryStripeAccountRepository } from './in-memory-stripe-account.repository';
import { ORDER_REPOSITORY } from './order.repository';
import { OrderService } from './order.service';
import { PRODUCT_REPOSITORY } from './product.repository';
import { ProductService } from './product.service';
import { SELLER_VERIFICATION_REPOSITORY } from './seller-verification.repository';
import { STRIPE_ACCOUNT_REPOSITORY } from './stripe-account.repository';
import { StripeConnectService } from './stripe-connect.service';
import { PLATFORM_FEE_RATE_SCHEDULE, PlatformFeeRateSchedule } from './stripe-connect.types';

/**
 * Real platform fee rates, per `roadmap/platform-fee-research.md` §2's
 * revised recommendation: 8% standard, 4% for Blue-Badge-verified shops.
 * Kept out of stripe-connect.service.ts's logic itself — the schedule is
 * threaded through as DI configuration, per the module's existing
 * pattern — so a future pricing review only touches this wiring.
 */
const PLATFORM_FEE_RATE_SCHEDULE_VALUE: PlatformFeeRateSchedule = {
  standardRate: 0.08,
  verifiedRate: 0.04,
};

@Module({
  providers: [
    ProductService,
    AuctionService,
    OrderService,
    StripeConnectService,
    { provide: PRODUCT_REPOSITORY, useClass: InMemoryProductRepository },
    { provide: AUCTION_REPOSITORY, useClass: InMemoryAuctionRepository },
    { provide: ORDER_REPOSITORY, useClass: InMemoryOrderRepository },
    { provide: STRIPE_ACCOUNT_REPOSITORY, useClass: InMemoryStripeAccountRepository },
    { provide: SELLER_VERIFICATION_REPOSITORY, useClass: InMemorySellerVerificationRepository },
    { provide: PLATFORM_FEE_RATE_SCHEDULE, useValue: PLATFORM_FEE_RATE_SCHEDULE_VALUE },
  ],
  exports: [ProductService, AuctionService, OrderService, StripeConnectService],
})
export class MarketplaceModule {}
