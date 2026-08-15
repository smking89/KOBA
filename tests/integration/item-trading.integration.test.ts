/**
 * Trading integration tests — require migrated Postgres:
 *   KOBA_TRADE_INTEGRATION=1
 *   DATABASE_URL=postgresql://...
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.KOBA_TRADE_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("trade integration", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let createInventoryItem: typeof import("@/features/inventory/services/inventory.service").createInventoryItem;
  let createTradeOffer: typeof import("@/features/trade/services/trade.service").createTradeOffer;
  let acceptTrade: typeof import("@/features/trade/services/trade.service").acceptTrade;
  let rejectTrade: typeof import("@/features/trade/services/trade.service").rejectTrade;
  let proposerId: string;
  let counterpartyId: string;
  let proposerKoba: string;
  let offeredRefs: string[] = [];
  let requestedRefs: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ createInventoryItem } = await import("@/features/inventory/services/inventory.service"));
    ({ createTradeOffer, acceptTrade, rejectTrade } =
      await import("@/features/trade/services/trade.service"));

    const stamp = Date.now();
    const proposer = await prisma.user.create({
      data: {
        email: `trade-a-${stamp}@koba.local`,
        profile: { create: { handle: `trada${stamp}`, activeAccountType: "PLAYER" } },
        kobaIdentities: {
          create: {
            code: `KBA-PLY-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "PLAYER",
          },
        },
      },
      include: { kobaIdentities: true },
    });
    const counterparty = await prisma.user.create({
      data: {
        email: `trade-b-${stamp}@koba.local`,
        profile: { create: { handle: `tradb${stamp}`, activeAccountType: "PLAYER" } },
        kobaIdentities: {
          create: {
            code: `KBA-PLY-${(stamp + 1).toString(16).slice(-8).toUpperCase()}`,
            accountType: "PLAYER",
          },
        },
      },
      include: { kobaIdentities: true },
    });
    proposerId = proposer.id;
    counterpartyId = counterparty.id;
    proposerKoba = counterparty.kobaIdentities[0]!.code;

    const a1 = await createInventoryItem({
      ownerUserId: proposerId,
      title: "A Skin",
      game: "Rust",
      platform: "PC",
      rarity: "EPIC",
      transferable: true,
      listedForTrade: true,
    });
    const a2 = await createInventoryItem({
      ownerUserId: proposerId,
      title: "A Kit",
      game: "Rust",
      platform: "PC",
      rarity: "EPIC",
      transferable: true,
      listedForTrade: true,
    });
    const b1 = await createInventoryItem({
      ownerUserId: counterpartyId,
      title: "B Skin",
      game: "Rust",
      platform: "PC",
      rarity: "EPIC",
      transferable: true,
      listedForTrade: true,
    });
    offeredRefs = [a1.publicRef];
    requestedRefs = [b1.publicRef];
    void a2;
  });

  afterAll(async () => {
    if (proposerId) await prisma.user.delete({ where: { id: proposerId } }).catch(() => undefined);
    if (counterpartyId)
      await prisma.user.delete({ where: { id: counterpartyId } }).catch(() => undefined);
  });

  it("rejects mixed rarity offers", async () => {
    const rare = await createInventoryItem({
      ownerUserId: counterpartyId,
      title: "Rare only",
      game: "Rust",
      platform: "PC",
      rarity: "RARE",
      transferable: true,
      listedForTrade: true,
    });
    await expect(
      createTradeOffer(proposerId, {
        counterpartyKobaId: proposerKoba,
        offeredInventoryRefs: offeredRefs,
        requestedInventoryRefs: [rare.publicRef],
        idempotencyKey: `mix-${Date.now()}`,
      }),
    ).rejects.toMatchObject({ code: "RARITY_MISMATCH" });
  });

  it("accepts atomically and transfers ownership", async () => {
    const trade = await createTradeOffer(proposerId, {
      counterpartyKobaId: proposerKoba,
      offeredInventoryRefs: offeredRefs,
      requestedInventoryRefs: requestedRefs,
      idempotencyKey: `ok-${Date.now()}`,
    });
    const completed = await acceptTrade(
      counterpartyId,
      trade.publicRef,
      `accept-${trade.publicRef}`,
    );
    expect(completed.state).toBe("COMPLETED");

    const offered = await prisma.inventoryItem.findUniqueOrThrow({
      where: { publicRef: offeredRefs[0]! },
    });
    const requested = await prisma.inventoryItem.findUniqueOrThrow({
      where: { publicRef: requestedRefs[0]! },
    });
    expect(offered.ownerUserId).toBe(counterpartyId);
    expect(requested.ownerUserId).toBe(proposerId);
    expect(offered.status).toBe("ACTIVE");
    expect(offered.lockTradeOfferId).toBeNull();
  });

  it("releases locks on reject", async () => {
    const a = await createInventoryItem({
      ownerUserId: proposerId,
      title: "Reject A",
      game: "Rust",
      platform: "PC",
      rarity: "LEGENDARY",
      transferable: true,
      listedForTrade: true,
    });
    const b = await createInventoryItem({
      ownerUserId: counterpartyId,
      title: "Reject B",
      game: "Rust",
      platform: "PC",
      rarity: "LEGENDARY",
      transferable: true,
      listedForTrade: true,
    });
    const trade = await createTradeOffer(proposerId, {
      counterpartyKobaId: proposerKoba,
      offeredInventoryRefs: [a.publicRef],
      requestedInventoryRefs: [b.publicRef],
      idempotencyKey: `rej-${Date.now()}`,
    });
    await rejectTrade(counterpartyId, trade.publicRef, {
      idempotencyKey: `reject-${trade.publicRef}`,
    });
    const locked = await prisma.inventoryItem.findUniqueOrThrow({
      where: { publicRef: a.publicRef },
    });
    expect(locked.status).toBe("ACTIVE");
    expect(locked.lockTradeOfferId).toBeNull();
  });
});
