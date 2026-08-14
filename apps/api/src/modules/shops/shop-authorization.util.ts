import { ShopNotOwnedByCallerError } from './shop.errors';
import { Shop } from './shop.types';

/**
 * Shared "only the shop's owner may do this" guard, used by every
 * shops-module service that gates a mutation to `Shop.ownerKobaId`
 * (`ShopService`, `ShopPromoService`, `ShopProductService`,
 * `ShopStripeConnectService`) so the check/error stays identical
 * everywhere instead of being re-implemented per service.
 */
export function assertShopOwner(shop: Shop, callerKobaId: string): void {
  if (shop.ownerKobaId !== callerKobaId) {
    throw new ShopNotOwnedByCallerError(shop.id, callerKobaId);
  }
}
