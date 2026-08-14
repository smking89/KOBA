import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { KOBA_ID_PATTERN } from '../kobaid/kobaid-format';
import { KobaIdRole } from '../kobaid/kobaid.types';
import { assertShopOwner } from './shop-authorization.util';
import { InvalidShopOwnerKobaIdFormatError, ShopNotFoundError, ShopOwnerMustBeBusinessRoleError } from './shop.errors';
import { SHOP_REPOSITORY, ShopRepository } from './shop.repository';
import { CreateShopParams, Shop, UpdateShopProfileParams } from './shop.types';

@Injectable()
export class ShopService {
  constructor(@Inject(SHOP_REPOSITORY) private readonly repository: ShopRepository) {}

  /**
   * Creates a Shop. `ownerKobaId` must be a Business-role (`BZ`) KOBAID —
   * a Player or Influencer KOBAID cannot own a Shop (ROADMAP.md Phase 4).
   * Validated structurally against the KOBA-ROLE-CODE format/role encoding
   * from `kobaid/kobaid-format.ts` (same posture as marketplace's
   * `sellerId`/`sellerKobaId` fields — a plain KOBAID string, not a
   * required-to-exist foreign key lookup this phase).
   */
  async createShop(params: CreateShopParams): Promise<Shop> {
    this.assertBusinessOwner(params.ownerKobaId);

    const shop: Shop = {
      id: randomUUID(),
      ownerKobaId: params.ownerKobaId,
      name: params.name,
      bio: params.bio ?? '',
      bannerUrl: params.bannerUrl ?? null,
      avatarUrl: params.avatarUrl ?? null,
      allowTagging: true,
      promoEligible: false,
      promoPayout: null,
      createdAt: new Date(),
    };

    return this.repository.save(shop);
  }

  async findById(id: string): Promise<Shop | null> {
    return this.repository.findById(id);
  }

  async getById(id: string): Promise<Shop> {
    const shop = await this.repository.findById(id);
    if (!shop) {
      throw new ShopNotFoundError(id);
    }
    return shop;
  }

  /**
   * Updates the shop's editable profile fields — name/bio/banner/avatar.
   * `id`/`ownerKobaId`/`createdAt` are never touched here; there is
   * deliberately no method anywhere in this module that mutates
   * `ownerKobaId` (see shop.types.ts's `Shop` docstring). Only the shop's
   * owner may update its profile.
   */
  async updateProfile(shopId: string, callerKobaId: string, params: UpdateShopProfileParams): Promise<Shop> {
    const shop = await this.getById(shopId);
    assertShopOwner(shop, callerKobaId);

    return this.repository.save({
      ...shop,
      name: params.name ?? shop.name,
      bio: params.bio ?? shop.bio,
      bannerUrl: params.bannerUrl !== undefined ? params.bannerUrl : shop.bannerUrl,
      avatarUrl: params.avatarUrl !== undefined ? params.avatarUrl : shop.avatarUrl,
    });
  }

  /**
   * Owner-controlled tag-permission flag (Phase 6's shop-level analogue —
   * see shop.types.ts's `Shop.allowTagging` docstring). No enforcement of
   * this flag anywhere yet; that's Phase 6.
   */
  async setAllowTagging(shopId: string, callerKobaId: string, allowTagging: boolean): Promise<Shop> {
    const shop = await this.getById(shopId);
    assertShopOwner(shop, callerKobaId);
    if (shop.allowTagging === allowTagging) {
      return shop;
    }
    return this.repository.save({ ...shop, allowTagging });
  }

  async isTaggingAllowed(shopId: string): Promise<boolean> {
    return (await this.getById(shopId)).allowTagging;
  }

  /** Parses/validates `ownerKobaId`'s role encoding; throws the typed errors above. */
  private assertBusinessOwner(ownerKobaId: string): KobaIdRole {
    const match = KOBA_ID_PATTERN.exec(ownerKobaId);
    if (!match) {
      throw new InvalidShopOwnerKobaIdFormatError(ownerKobaId);
    }
    const role = match[1] as KobaIdRole;
    if (role !== KobaIdRole.BUSINESS) {
      throw new ShopOwnerMustBeBusinessRoleError(ownerKobaId, role);
    }
    return role;
  }
}
