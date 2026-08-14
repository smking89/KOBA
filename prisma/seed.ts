import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { generateKobaIdCode } from "../features/koba-id/lib/format";
import { RARITY_RANK } from "../features/marketplace/lib/catalog";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://koba:koba@localhost:5432/koba?schema=public";

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const games = [
  { slug: "rust", name: "Rust" },
  { slug: "minecraft", name: "Minecraft" },
  { slug: "ark-survival-ascended", name: "ARK: Survival Ascended" },
  { slug: "dayz", name: "DayZ" },
  { slug: "conan-exiles", name: "Conan Exiles" },
  { slug: "valheim", name: "Valheim" },
] as const;

const categories = [
  { slug: "skins", name: "Skins", kind: "SKINS" as const },
  { slug: "maps", name: "Maps", kind: "MAPS" as const },
  { slug: "monuments", name: "Monuments", kind: "MONUMENTS" as const },
  { slug: "kits", name: "Kits", kind: "KITS" as const },
  { slug: "cosmetics", name: "Cosmetics", kind: "COSMETICS" as const },
  { slug: "server-assets", name: "Server assets", kind: "SERVER_ASSETS" as const },
] as const;

async function main() {
  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: { name: game.name },
      create: game,
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, kind: category.kind },
      create: category,
    });
  }

  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 12);
  const seller = await prisma.user.upsert({
    where: { email: "catalog@koba.local" },
    update: {},
    create: {
      email: "catalog@koba.local",
      name: "Ironwright Trading Co.",
      emailVerified: new Date(),
      passwordHash,
      profile: {
        create: {
          displayName: "Ironwright Trading Co.",
          activeAccountType: "BUSINESS",
          kobaIdRevealedAt: new Date(),
        },
      },
    },
  });

  const existingIdentities = await prisma.kobaIdentity.findMany({ where: { userId: seller.id } });
  if (!existingIdentities.some((row) => row.accountType === "BUSINESS")) {
    await prisma.kobaIdentity.create({
      data: {
        userId: seller.id,
        accountType: "BUSINESS",
        code: generateKobaIdCode("BUSINESS", (size) => randomBytes(size)),
      },
    });
  }

  const rust = await prisma.game.findUniqueOrThrow({ where: { slug: "rust" } });
  const ark = await prisma.game.findUniqueOrThrow({ where: { slug: "ark-survival-ascended" } });
  const conan = await prisma.game.findUniqueOrThrow({ where: { slug: "conan-exiles" } });
  const monuments = await prisma.category.findUniqueOrThrow({ where: { slug: "monuments" } });
  const cosmetics = await prisma.category.findUniqueOrThrow({ where: { slug: "cosmetics" } });
  const skins = await prisma.category.findUniqueOrThrow({ where: { slug: "skins" } });

  const listings = [
    {
      slug: "oxide-camo-monument-kit",
      title: "Oxide Camo Monument Kit",
      description:
        "Hand-authored monument replacing Launch Site's central silo — full RCON-ready spawn config, tested on modded and vanilla+ servers.",
      rarity: "LEGENDARY" as const,
      listingType: "AUCTION" as const,
      priceCents: 4600,
      inventoryQty: 1,
      platforms: ["STEAM", "XBOX", "PLAYSTATION"] as const,
      gameId: rust.id,
      categoryId: monuments.id,
      variants: [
        { sku: "OXC-PC", name: "PC blueprint", inventoryQty: 1, priceCents: 4600 },
        { sku: "OXC-CON", name: "Console kit", inventoryQty: 3, priceCents: 2800 },
      ],
    },
    {
      slug: "wyvern-crest-avatar",
      title: "Avatar Decoration — Wyvern Crest",
      description:
        "Profile crest for ARK communities. Cosmetic display only — not a gameplay item.",
      rarity: "EPIC" as const,
      listingType: "FIXED" as const,
      priceCents: 1800,
      inventoryQty: 25,
      platforms: ["STEAM"] as const,
      gameId: ark.id,
      categoryId: cosmetics.id,
      variants: [],
    },
    {
      slug: "ember-wake-profile-effect",
      title: "Profile Effect — Ember Wake",
      description:
        "Relic 1-of-1 profile effect. Unique, non-transferable display once checkout ships.",
      rarity: "RELIC" as const,
      listingType: "AUCTION" as const,
      priceCents: 12000,
      inventoryQty: 1,
      platforms: ["STEAM", "XBOX", "PLAYSTATION", "PC"] as const,
      gameId: conan.id,
      categoryId: cosmetics.id,
      variants: [],
    },
    {
      slug: "bronze-age-nameplate",
      title: "Bronze-Age Nameplate",
      description: "Rust nameplate for shop and group headers.",
      rarity: "RARE" as const,
      listingType: "FIXED" as const,
      priceCents: 900,
      inventoryQty: 40,
      platforms: ["STEAM"] as const,
      gameId: rust.id,
      categoryId: cosmetics.id,
      variants: [],
    },
    {
      slug: "trader-skin-bundle",
      title: "Trader Skin Bundle",
      description: "Common trader skins. Currently sold out.",
      rarity: "COMMON" as const,
      listingType: "FIXED" as const,
      priceCents: 800,
      inventoryQty: 0,
      platforms: ["STEAM"] as const,
      gameId: rust.id,
      categoryId: skins.id,
      variants: [],
    },
  ];

  for (const listing of listings) {
    const product = await prisma.product.upsert({
      where: { slug: listing.slug },
      update: {
        title: listing.title,
        description: listing.description,
        rarity: listing.rarity,
        rarityRank: RARITY_RANK[listing.rarity],
        listingType: listing.listingType,
        moderationStatus: "APPROVED",
        priceCents: listing.priceCents,
        inventoryQty: listing.inventoryQty,
        platforms: [...listing.platforms],
        publishedAt: new Date(),
      },
      create: {
        slug: listing.slug,
        title: listing.title,
        description: listing.description,
        rarity: listing.rarity,
        rarityRank: RARITY_RANK[listing.rarity],
        listingType: listing.listingType,
        moderationStatus: "APPROVED",
        priceCents: listing.priceCents,
        inventoryQty: listing.inventoryQty,
        platforms: [...listing.platforms],
        sellerUserId: seller.id,
        gameId: listing.gameId,
        categoryId: listing.categoryId,
        publishedAt: new Date(),
        media: {
          create: {
            url: "",
            alt: listing.title,
            sortOrder: 0,
          },
        },
      },
    });

    if (listing.variants.length > 0) {
      for (const variant of listing.variants) {
        await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: {
            name: variant.name,
            priceCents: variant.priceCents,
            inventoryQty: variant.inventoryQty,
            productId: product.id,
          },
          create: {
            sku: variant.sku,
            name: variant.name,
            priceCents: variant.priceCents,
            inventoryQty: variant.inventoryQty,
            productId: product.id,
          },
        });
      }
    }
  }

  console.info("KOBA marketplace catalog seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
