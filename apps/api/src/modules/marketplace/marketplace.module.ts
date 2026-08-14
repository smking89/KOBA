import { Module } from '@nestjs/common';
import { AUCTION_REPOSITORY } from './auction.repository';
import { AuctionService } from './auction.service';
import { InMemoryAuctionRepository } from './in-memory-auction.repository';
import { InMemoryOrderRepository } from './in-memory-order.repository';
import { InMemoryProductRepository } from './in-memory-product.repository';
import { InMemoryStripeAccountRepository } from './in-memory-stripe-account.repository';
import { ORDER_REPOSITORY } from './order.repository';
import { OrderService } from './order.service';
import { PRODUCT_REPOSITORY } from './product.repository';
import { ProductService } from './product.service';
import { STRIPE_ACCOUNT_REPOSITORY } from './stripe-account.repository';
import { StripeConnectService } from './stripe-connect.service';
import { PLATFORM_FEE_RATE } from './stripe-connect.types';

/**
 * TODO(platform fee rate): ROADMAP.md's "Open questions for the client"
 * #8 — the client hasn't confirmed the platform fee %, flat vs. tiered,
 * or whether it differs by product type/rarity. This default is a
 * placeholder only (kept out of stripe-connect.service.ts's logic itself
 * — the rate is threaded through as DI configuration, per the task's
 * constraint), not a product decision. Override via a real config module
 * once the client answers.
 */
const PLACEHOLDER_PLATFORM_FEE_RATE = 0.1;

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
    { provide: PLATFORM_FEE_RATE, useValue: PLACEHOLDER_PLATFORM_FEE_RATE },
  ],
  exports: [ProductService, AuctionService, OrderService, StripeConnectService],
})
export class MarketplaceModule {}
