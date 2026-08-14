import { describe, expect, it } from "vitest";
import {
  buildPublicProductWhere,
  buildProductOrderBy,
} from "@/features/marketplace/lib/product-query";
import { isPubliclyListed, formatPrice } from "@/features/marketplace/lib/catalog";
import { parseMarketQuery, marketQuerySchema } from "@/features/marketplace/schemas/market.schemas";

describe("marketplace visibility", () => {
  it("only treats approved published listings as public", () => {
    expect(isPubliclyListed({ moderationStatus: "APPROVED", publishedAt: new Date() })).toBe(true);
    expect(isPubliclyListed({ moderationStatus: "DRAFT", publishedAt: new Date() })).toBe(false);
    expect(isPubliclyListed({ moderationStatus: "APPROVED", publishedAt: null })).toBe(false);
    expect(isPubliclyListed({ moderationStatus: "PENDING", publishedAt: new Date() })).toBe(false);
  });

  it("always constrains catalog queries to approved published products", () => {
    const where = buildPublicProductWhere({
      sort: "newest",
      page: 1,
      pageSize: 12,
    });
    expect(where.moderationStatus).toBe("APPROVED");
    expect(where.publishedAt).toEqual({ not: null });
  });
});

describe("marketplace filters", () => {
  it("parses search, game, rarity, platform, and sort", () => {
    const query = parseMarketQuery({
      q: "oxide",
      game: "rust",
      category: "monuments",
      rarity: "LEGENDARY",
      platform: "STEAM",
      sort: "price_desc",
      page: "2",
    });
    expect(query.q).toBe("oxide");
    expect(query.game).toBe("rust");
    expect(query.rarity).toBe("LEGENDARY");
    expect(query.platform).toBe("STEAM");
    expect(query.sort).toBe("price_desc");
    expect(query.page).toBe(2);

    const where = buildPublicProductWhere(query);
    expect(where.game).toEqual({ slug: "rust" });
    expect(where.category).toEqual({ slug: "monuments" });
    expect(where.rarity).toBe("LEGENDARY");
    expect(where.platforms).toEqual({ has: "STEAM" });
  });

  it("rejects staff-like junk and unknown sort by falling back", () => {
    const query = parseMarketQuery({ sort: "hacked", rarity: "STAFF", page: "0" });
    expect(query.sort).toBe("newest");
    expect(query.rarity).toBeUndefined();
    expect(query.page).toBe(1);
  });

  it("caps page size", () => {
    const parsed = marketQuerySchema.safeParse({ pageSize: 999 });
    expect(parsed.success).toBe(false);
  });

  it("maps sort keys to orderBy", () => {
    expect(buildProductOrderBy("price_asc")).toEqual({ priceCents: "asc" });
    expect(buildProductOrderBy("rarity")).toEqual({ rarityRank: "desc" });
    expect(buildProductOrderBy("newest")).toEqual({ publishedAt: "desc" });
  });

  it("formats prices from cents", () => {
    expect(formatPrice(4600)).toBe("$46.00");
  });
});
