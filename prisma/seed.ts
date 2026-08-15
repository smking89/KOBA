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

// Per-game content policy from the ARK deep-dive + per-title ToS sweep
// (2026-08-14, docs/game-content-policy.md) — desk research, not legal
// counsel. See that doc before changing any of these.
const games = [
  { slug: "rust", name: "Rust", contentPolicy: "FULL" as const, policyNote: null },
  {
    slug: "garrys-mod",
    name: "Garry's Mod",
    contentPolicy: "FULL" as const,
    policyNote:
      'Facepunch\'s own legal docs: "Can I sell a Mod I own? Yes" — server cosmetics explicitly permitted too.',
  },
  {
    slug: "minecraft",
    name: "Minecraft",
    contentPolicy: "SKINS_ONLY" as const,
    policyNote:
      "EULA bans currency-for-cash/pay-to-win; cosmetics/social perks are the sanctioned path.",
  },
  {
    slug: "dayz",
    name: "DayZ",
    contentPolicy: "SKINS_ONLY" as const,
    policyNote:
      "Official Bohemia server monetization policy: cosmetics/perks on private shards only.",
  },
  {
    slug: "ark-survival-ascended",
    name: "ARK: Survival Ascended",
    contentPolicy: "EXCLUDED" as const,
    policyNote:
      "Wildcard's own CurseForge moderation guidelines mandate Tebex-wallet-only payout for monetized mods — conflicts with KOBA's Stripe Connect architecture; no compliant path found.",
  },
  {
    slug: "conan-exiles",
    name: "Conan Exiles",
    contentPolicy: "EXCLUDED" as const,
    policyNote:
      "Funcom EULA explicitly bans selling Virtual Goods/Game Currency and secondary markets; no cosmetics carve-out found.",
  },
  {
    slug: "valheim",
    name: "Valheim",
    contentPolicy: "EXCLUDED" as const,
    policyNote:
      "Official Iron Gate developer statement directly opposes paid mods; no server-cosmetics system exists as a fallback.",
  },
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
      update: {
        name: game.name,
        contentPolicy: game.contentPolicy,
        policyNote: game.policyNote,
      },
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
          handle: "ironwright",
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

  const shop = await prisma.shop.upsert({
    where: { slug: "ironwright-trading-co" },
    update: {
      name: "Ironwright Trading Co.",
      bio: "Verified Rust monument kits, cosmetics, and server assets for community operators.",
      verificationStatus: "VERIFIED",
    },
    create: {
      slug: "ironwright-trading-co",
      name: "Ironwright Trading Co.",
      bio: "Verified Rust monument kits, cosmetics, and server assets for community operators.",
      ownerUserId: seller.id,
      verificationStatus: "VERIFIED",
    },
  });

  await prisma.shopMember.upsert({
    where: { shopId_userId: { shopId: shop.id, userId: seller.id } },
    update: { role: "OWNER" },
    create: { shopId: shop.id, userId: seller.id, role: "OWNER" },
  });

  const rust = await prisma.game.findUniqueOrThrow({ where: { slug: "rust" } });
  // ARK: Survival Ascended and Conan Exiles are EXCLUDED per
  // docs/game-content-policy.md — demo listings below use compliant
  // games instead (Garry's Mod, DayZ) rather than seeding data that
  // violates the policy this repo enforces.
  const garrysMod = await prisma.game.findUniqueOrThrow({ where: { slug: "garrys-mod" } });
  const dayz = await prisma.game.findUniqueOrThrow({ where: { slug: "dayz" } });
  const monuments = await prisma.category.findUniqueOrThrow({ where: { slug: "monuments" } });
  const skins = await prisma.category.findUniqueOrThrow({ where: { slug: "skins" } });
  const kits = await prisma.category.findUniqueOrThrow({ where: { slug: "kits" } });

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
    {
      slug: "chroma-playermodel-skin",
      title: "Chroma Playermodel Skin",
      description: "Full-body playermodel reskin for Garry's Mod servers.",
      rarity: "EPIC" as const,
      listingType: "FIXED" as const,
      priceCents: 1200,
      inventoryQty: 50,
      platforms: ["STEAM"] as const,
      gameId: garrysMod.id,
      categoryId: skins.id,
      variants: [],
    },
    {
      slug: "wasteland-outfit-skin",
      title: "Wasteland Outfit Skin",
      // DayZ is SKINS_ONLY per docs/game-content-policy.md — this listing
      // exists specifically to demonstrate a real compliant DayZ listing.
      description: "In-game clothing skin for DayZ private shards.",
      rarity: "RARE" as const,
      listingType: "FIXED" as const,
      priceCents: 700,
      inventoryQty: 30,
      platforms: ["STEAM"] as const,
      gameId: dayz.id,
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
        shopId: shop.id,
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
        shopId: shop.id,
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

  // Real Cosmetic rows (avatar decoration/profile effect/nameplate) —
  // these were previously modeled as Product rows tied to a gameId, which
  // was wrong: Cosmetics are universal KOBA profile/shop customization,
  // never game-specific (see docs/game-content-policy.md), priced in USD
  // like the rest of the marketplace, and unrelated to any single game's
  // ToS. gameId does not exist on this model at all.
  const cosmeticSeeds = [
    {
      slug: "wyvern-crest-avatar",
      subType: "AVATAR_DECORATION" as const,
      name: "Avatar Decoration — Wyvern Crest",
      description: "Animated profile crest. Cosmetic display only — not a gameplay item.",
      rarity: "EPIC" as const,
      priceCents: 1800,
    },
    {
      slug: "ember-wake-profile-effect",
      subType: "PROFILE_EFFECT" as const,
      name: "Profile Effect — Ember Wake",
      description: "Relic 1-of-1 profile effect. Unique, non-transferable display.",
      rarity: "RELIC" as const,
      priceCents: 12000,
    },
    {
      slug: "bronze-age-nameplate",
      subType: "NAMEPLATE" as const,
      name: "Bronze-Age Nameplate",
      description: "Nameplate for shop and group headers.",
      rarity: "RARE" as const,
      priceCents: 900,
    },
  ] as const;

  for (const cosmetic of cosmeticSeeds) {
    await prisma.cosmetic.upsert({
      where: { slug: cosmetic.slug },
      update: {
        subType: cosmetic.subType,
        name: cosmetic.name,
        description: cosmetic.description,
        rarity: cosmetic.rarity,
        priceCents: cosmetic.priceCents,
        moderationStatus: "APPROVED",
      },
      create: {
        slug: cosmetic.slug,
        ownerShopId: shop.id,
        subType: cosmetic.subType,
        name: cosmetic.name,
        description: cosmetic.description,
        rarity: cosmetic.rarity,
        priceCents: cosmetic.priceCents,
        currency: "USD",
        moderationStatus: "APPROVED",
      },
    });
  }

  const now = new Date();
  const auctionSeeds = [{ slug: "oxide-camo-monument-kit", hours: 2, increment: 1000 }] as const;

  for (const seed of auctionSeeds) {
    const product = await prisma.product.findUniqueOrThrow({ where: { slug: seed.slug } });
    const endsAt = new Date(now.getTime() + seed.hours * 60 * 60 * 1000);
    await prisma.auction.upsert({
      where: { productId: product.id },
      update: {
        status: "LIVE",
        startingBidCents: product.priceCents,
        minIncrementCents: seed.increment,
        startsAt: now,
        endsAt,
      },
      create: {
        productId: product.id,
        status: "LIVE",
        startingBidCents: product.priceCents,
        minIncrementCents: seed.increment,
        startsAt: now,
        endsAt,
      },
    });
  }

  const player = await prisma.user.upsert({
    where: { email: "maxbuilds@koba.local" },
    update: {},
    create: {
      email: "maxbuilds@koba.local",
      name: "maxbuilds",
      emailVerified: new Date(),
      passwordHash,
      profile: {
        create: {
          handle: "maxbuilds",
          displayName: "maxbuilds",
          bio: "Wipe-night builder. Tagging: followers only.",
          activeAccountType: "PLAYER",
          kobaIdRevealedAt: new Date(),
        },
      },
    },
  });
  const playerIdentities = await prisma.kobaIdentity.findMany({ where: { userId: player.id } });
  if (!playerIdentities.some((row) => row.accountType === "PLAYER")) {
    await prisma.kobaIdentity.create({
      data: {
        userId: player.id,
        accountType: "PLAYER",
        code: generateKobaIdCode("PLAYER", (size) => randomBytes(size)),
      },
    });
  }

  const group = await prisma.group.upsert({
    where: { slug: "rust-legacy-raiders" },
    update: {
      name: "Rust Legacy Raiders",
      bio: "Wipe-day raids, monument kits, and legacy skin restoration. Public group — tagging allowed.",
      visibility: "PUBLIC",
    },
    create: {
      slug: "rust-legacy-raiders",
      name: "Rust Legacy Raiders",
      bio: "Wipe-day raids, monument kits, and legacy skin restoration. Public group — tagging allowed.",
      visibility: "PUBLIC",
      ownerUserId: seller.id,
      members: {
        create: [
          { userId: seller.id, role: "OWNER" },
          { userId: player.id, role: "MODERATOR" },
        ],
      },
    },
  });
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: seller.id } },
    update: { role: "OWNER" },
    create: { groupId: group.id, userId: seller.id, role: "OWNER" },
  });
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: player.id } },
    update: { role: "MODERATOR" },
    create: { groupId: group.id, userId: player.id, role: "MODERATOR" },
  });

  await prisma.lfgPost.upsert({
    where: { publicRef: "KOBA-LFG-WIPE0001" },
    update: {
      title: "Wipe Day Squad",
      body: "Full wipe, official-rate, mic required. Need two more for vanilla+.",
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      status: "OPEN",
      slotsFilled: 3,
      slotsTotal: 5,
    },
    create: {
      publicRef: "KOBA-LFG-WIPE0001",
      authorUserId: player.id,
      title: "Wipe Day Squad",
      body: "Full wipe, official-rate, mic required. Need two more for vanilla+.",
      gameId: rust.id,
      platform: "STEAM",
      region: "NA",
      timezone: "America/New_York",
      skillLevel: "INTERMEDIATE",
      mic: "REQUIRED",
      availability: "Wipe night 8PM EST",
      slotsTotal: 5,
      slotsFilled: 3,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });

  await prisma.accountProfile.update({
    where: { userId: seller.id },
    data: { handle: "ironwright", displayName: "Ironwright Trading Co." },
  });
  await prisma.accountProfile.update({
    where: { userId: player.id },
    data: {
      handle: "maxbuilds",
      displayName: "maxbuilds",
      bio: "Wipe-night builder. Tagging: followers only.",
    },
  });

  await prisma.userFollow.upsert({
    where: {
      followerUserId_followingUserId: {
        followerUserId: player.id,
        followingUserId: seller.id,
      },
    },
    update: {},
    create: { followerUserId: player.id, followingUserId: seller.id },
  });

  await prisma.post.upsert({
    where: { publicRef: "KOBA-PST-FEED0001" },
    update: {
      body: "Wipe-ready kits from @ironwright — tagging the shop and group. Not a sponsored post.",
      visibility: "PUBLIC",
      sponsored: false,
      groupId: group.id,
    },
    create: {
      publicRef: "KOBA-PST-FEED0001",
      authorUserId: player.id,
      groupId: group.id,
      body: "Wipe-ready kits from @ironwright — tagging the shop and group. Not a sponsored post.",
      visibility: "PUBLIC",
      sponsored: false,
      tags: {
        create: [
          { targetType: "USER", targetSlug: "ironwright" },
          { targetType: "SHOP", targetSlug: "ironwright-trading-co" },
          { targetType: "GROUP", targetSlug: "rust-legacy-raiders" },
        ],
      },
    },
  });

  await prisma.story.upsert({
    where: { publicRef: "KOBA-STY-WIPE0001" },
    update: {
      body: "On for wipe night. Story expires in 24h.",
      expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
    },
    create: {
      publicRef: "KOBA-STY-WIPE0001",
      authorUserId: player.id,
      body: "On for wipe night. Story expires in 24h.",
      expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
    },
  });

  const pairKey = [player.id, seller.id].sort().join(":");
  const conversation = await prisma.conversation.upsert({
    where: { pairKey },
    update: { vanishMode: false, lastMessageAt: new Date() },
    create: {
      publicRef: "KOBA-DM-WIPE0001",
      pairKey,
      vanishMode: false,
      lastMessageAt: new Date(),
      participants: {
        create: [{ userId: player.id }, { userId: seller.id }],
      },
    },
  });
  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId: player.id },
    },
    update: {},
    create: { conversationId: conversation.id, userId: player.id },
  });
  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId: seller.id },
    },
    update: {},
    create: { conversationId: conversation.id, userId: seller.id },
  });
  await prisma.directMessage.upsert({
    where: { publicRef: "KOBA-MSG-WIPE0001" },
    update: {
      body: "Still down to trade for the Wyvern crest?",
      deletedAt: null,
    },
    create: {
      publicRef: "KOBA-MSG-WIPE0001",
      conversationId: conversation.id,
      senderUserId: player.id,
      kind: "TEXT",
      body: "Still down to trade for the Wyvern crest?",
    },
  });
  await prisma.directMessage.upsert({
    where: { publicRef: "KOBA-MSG-WIPE0002" },
    update: {
      body: "Yeah — I'll throw in $8 on top.",
      deletedAt: null,
    },
    create: {
      publicRef: "KOBA-MSG-WIPE0002",
      conversationId: conversation.id,
      senderUserId: seller.id,
      kind: "TEXT",
      body: "Yeah — I'll throw in $8 on top.",
    },
  });

  const staffPasswordHash = await bcrypt.hash("KobaStaff1!", 12);
  const staff = await prisma.user.upsert({
    where: { email: "staff@koba.local" },
    update: {
      passwordHash: staffPasswordHash,
      emailVerified: new Date(),
    },
    create: {
      email: "staff@koba.local",
      name: "KOBA Staff",
      emailVerified: new Date(),
      passwordHash: staffPasswordHash,
      profile: {
        create: {
          handle: "kobastaff",
          displayName: "KOBA Staff",
          activeAccountType: "SUPERADMIN",
          kobaIdRevealedAt: new Date(),
        },
      },
    },
  });

  await prisma.accountProfile.upsert({
    where: { userId: staff.id },
    update: {
      handle: "kobastaff",
      displayName: "KOBA Staff",
      activeAccountType: "SUPERADMIN",
      kobaIdRevealedAt: new Date(),
    },
    create: {
      userId: staff.id,
      handle: "kobastaff",
      displayName: "KOBA Staff",
      activeAccountType: "SUPERADMIN",
      kobaIdRevealedAt: new Date(),
    },
  });

  const staffIdentities = await prisma.kobaIdentity.findMany({ where: { userId: staff.id } });
  if (!staffIdentities.some((row) => row.accountType === "SUPERADMIN")) {
    await prisma.kobaIdentity.create({
      data: {
        userId: staff.id,
        accountType: "SUPERADMIN",
        code: generateKobaIdCode("SUPERADMIN", (size) => randomBytes(size)),
      },
    });
  }

  const pendingApplicantPassword = await bcrypt.hash(randomBytes(24).toString("hex"), 12);
  const applicant = await prisma.user.upsert({
    where: { email: "maps@koba.local" },
    update: {},
    create: {
      email: "maps@koba.local",
      name: "Raid Ready Maps",
      emailVerified: new Date(),
      passwordHash: pendingApplicantPassword,
      profile: {
        create: {
          handle: "raidmaps",
          displayName: "Raid Ready Maps",
          activeAccountType: "BUSINESS",
          kobaIdRevealedAt: new Date(),
        },
      },
    },
  });

  await prisma.accountProfile.upsert({
    where: { userId: applicant.id },
    update: {
      handle: "raidmaps",
      displayName: "Raid Ready Maps",
      activeAccountType: "BUSINESS",
    },
    create: {
      userId: applicant.id,
      handle: "raidmaps",
      displayName: "Raid Ready Maps",
      activeAccountType: "BUSINESS",
    },
  });

  const applicantIdentities = await prisma.kobaIdentity.findMany({
    where: { userId: applicant.id },
  });
  if (!applicantIdentities.some((row) => row.accountType === "BUSINESS")) {
    await prisma.kobaIdentity.create({
      data: {
        userId: applicant.id,
        accountType: "BUSINESS",
        code: generateKobaIdCode("BUSINESS", (size) => randomBytes(size)),
      },
    });
  }

  const pendingShop = await prisma.shop.upsert({
    where: { slug: "raid-ready-maps" },
    update: {
      name: "Raid Ready Maps",
      bio: "Custom Rust monuments awaiting KOBA verification.",
      verificationStatus: "PENDING",
    },
    create: {
      slug: "raid-ready-maps",
      name: "Raid Ready Maps",
      bio: "Custom Rust monuments awaiting KOBA verification.",
      ownerUserId: applicant.id,
      verificationStatus: "PENDING",
    },
  });

  await prisma.shopMember.upsert({
    where: { shopId_userId: { shopId: pendingShop.id, userId: applicant.id } },
    update: { role: "OWNER" },
    create: { shopId: pendingShop.id, userId: applicant.id, role: "OWNER" },
  });

  // Phase 14C — transferable listed inventory for demo trades (same rarity tier).
  const seedInventory = [
    {
      publicRef: "KOBA-INV-SEED0001",
      ownerUserId: seller.id,
      title: "Oxide Camo Crest",
      game: "Rust",
      platform: "STEAM" as const,
      rarity: "EPIC" as const,
    },
    {
      publicRef: "KOBA-INV-SEED0002",
      ownerUserId: seller.id,
      title: "Ironwright Ember Charm",
      game: "Rust",
      platform: "STEAM" as const,
      rarity: "EPIC" as const,
    },
    {
      publicRef: "KOBA-INV-SEED0003",
      ownerUserId: seller.id,
      title: "Raid Beacon Decal",
      game: "Garry's Mod",
      platform: "STEAM" as const,
      rarity: "EPIC" as const,
    },
    {
      publicRef: "KOBA-INV-SEED0004",
      ownerUserId: applicant.id,
      title: "Wyvern Profile Effect",
      game: "Garry's Mod",
      platform: "STEAM" as const,
      rarity: "EPIC" as const,
    },
    {
      publicRef: "KOBA-INV-SEED0005",
      ownerUserId: applicant.id,
      title: "Monument Blueprint Folio",
      game: "Rust",
      platform: "STEAM" as const,
      rarity: "EPIC" as const,
    },
    {
      publicRef: "KOBA-INV-SEED0006",
      ownerUserId: applicant.id,
      title: "Trade Token",
      game: "DayZ",
      platform: "STEAM" as const,
      rarity: "EPIC" as const,
    },
  ] as const;

  for (const item of seedInventory) {
    await prisma.inventoryItem.upsert({
      where: { publicRef: item.publicRef },
      update: {
        ownerUserId: item.ownerUserId,
        title: item.title,
        game: item.game,
        platform: item.platform,
        rarity: item.rarity,
        transferable: true,
        listedForTrade: true,
        status: "ACTIVE",
        acquisitionSource: "SEED",
        lockTradeOfferId: null,
      },
      create: {
        publicRef: item.publicRef,
        ownerUserId: item.ownerUserId,
        title: item.title,
        game: item.game,
        platform: item.platform,
        rarity: item.rarity,
        transferable: true,
        listedForTrade: true,
        status: "ACTIVE",
        acquisitionSource: "SEED",
      },
    });
  }

  await prisma.product.upsert({
    where: { slug: "pending-oil-rig-kit" },
    update: {
      title: "Oil Rig Kit (pending review)",
      description: "Seeded listing waiting for staff approval.",
      moderationStatus: "PENDING",
      publishedAt: null,
      shopId: shop.id,
      priceCents: 2400,
      inventoryQty: 5,
    },
    create: {
      slug: "pending-oil-rig-kit",
      title: "Oil Rig Kit (pending review)",
      description: "Seeded listing waiting for staff approval.",
      rarity: "RARE",
      rarityRank: RARITY_RANK.RARE,
      listingType: "FIXED",
      moderationStatus: "PENDING",
      priceCents: 2400,
      inventoryQty: 5,
      platforms: ["STEAM"],
      sellerUserId: seller.id,
      shopId: shop.id,
      gameId: rust.id,
      categoryId: kits.id,
      publishedAt: null,
    },
  });

  await prisma.contentReport.upsert({
    where: { publicRef: "KOBA-RPT-STAFF001" },
    update: {
      reason: "Seeded open report for the staff queue.",
      status: "OPEN",
      targetType: "POST",
      targetRef: "KOBA-PST-FEED0001",
    },
    create: {
      publicRef: "KOBA-RPT-STAFF001",
      reporterUserId: player.id,
      targetType: "POST",
      targetRef: "KOBA-PST-FEED0001",
      reason: "Seeded open report for the staff queue.",
      status: "OPEN",
    },
  });

  console.info(
    "KOBA shops, catalog, auctions, groups, LFG, social, messages, and staff queues seeded.",
  );
  console.info("Local staff login: staff@koba.local / KobaStaff1!");

  // Development-only Coin wallets (ledger-compatible, idempotent)
  if (process.env.NODE_ENV !== "production") {
    const { grantPromotionalCoins } = await import("../features/wallet/services/ledger.service");
    const seededUser = await prisma.user.findUnique({ where: { email: "catalog@koba.local" } });
    if (seededUser) {
      await grantPromotionalCoins({
        userId: seededUser.id,
        amount: 250,
        memo: "Development promotional KOBA Coins (seed)",
        idempotencyKey: `seed:promo:${seededUser.id}:v1`,
      });
      console.info("Seeded development promotional Coins for catalog@koba.local");
    }
  }
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
