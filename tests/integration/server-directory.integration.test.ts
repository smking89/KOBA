/**
 * Server directory integration tests — require migrated Postgres:
 *   KOBA_SERVER_INTEGRATION=1
 *   DATABASE_URL=postgresql://...
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.KOBA_SERVER_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("server directory integration", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let createServer: typeof import("@/features/servers/services/server.service").createServer;
  let submitForVerification: typeof import("@/features/servers/services/server.service").submitForVerification;
  let staffModerateServer: typeof import("@/features/servers/services/server.service").staffModerateServer;
  let toggleFavourite: typeof import("@/features/servers/services/server.service").toggleFavourite;
  let listAccountServers: typeof import("@/features/servers/services/server.service").listAccountServers;
  let updateServer: typeof import("@/features/servers/services/server.service").updateServer;
  let switchActiveAccount: typeof import("@/features/accounts/services/account.service").switchActiveAccount;

  let playerId: string;
  let businessId: string;
  let influencerId: string;
  let staffId: string;
  let serverSlug: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({
      createServer,
      submitForVerification,
      staffModerateServer,
      toggleFavourite,
      listAccountServers,
      updateServer,
    } = await import("@/features/servers/services/server.service"));
    ({ switchActiveAccount } = await import("@/features/accounts/services/account.service"));

    const stamp = Date.now();
    const player = await prisma.user.create({
      data: {
        email: `srv-player-${stamp}@koba.local`,
        profile: { create: { handle: `srvpl${stamp}`, activeAccountType: "PLAYER" } },
        kobaIdentities: {
          create: {
            code: `KBA-PLY-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "PLAYER",
          },
        },
      },
    });
    const business = await prisma.user.create({
      data: {
        email: `srv-biz-${stamp}@koba.local`,
        profile: { create: { handle: `srvbz${stamp}`, activeAccountType: "BUSINESS" } },
        kobaIdentities: {
          create: [
            {
              code: `KBA-BIZ-${stamp.toString(16).slice(-8).toUpperCase()}`,
              accountType: "BUSINESS",
            },
            {
              code: `KBA-INF-${stamp.toString(16).slice(-8).toUpperCase()}`,
              accountType: "INFLUENCER",
            },
          ],
        },
      },
    });
    const influencer = await prisma.user.create({
      data: {
        email: `srv-inf-${stamp}@koba.local`,
        profile: { create: { handle: `srvif${stamp}`, activeAccountType: "INFLUENCER" } },
        kobaIdentities: {
          create: {
            code: `KBA-INF-${(stamp + 1).toString(16).slice(-8).toUpperCase()}`,
            accountType: "INFLUENCER",
          },
        },
      },
    });
    const staff = await prisma.user.create({
      data: {
        email: `srv-staff-${stamp}@koba.local`,
        profile: { create: { handle: `srvst${stamp}`, activeAccountType: "ADMIN" } },
        kobaIdentities: {
          create: {
            code: `KBA-ADM-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "ADMIN",
          },
        },
      },
    });

    playerId = player.id;
    businessId = business.id;
    influencerId = influencer.id;
    staffId = staff.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.serverFavourite.deleteMany({
      where: { userId: { in: [playerId, businessId, influencerId] } },
    });
    await prisma.gameServer.deleteMany({
      where: { ownerUserId: { in: [businessId, influencerId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [playerId, businessId, influencerId, staffId] } },
    });
  });

  it("rejects player registration", async () => {
    await expect(
      createServer(playerId, {
        name: "Player Server",
        game: "rust",
        platformFamily: "PC",
        region: "US-East",
        tags: [],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_ROLE" });
  });

  it("allows business and influencer registration", async () => {
    const biz = await createServer(businessId, {
      name: "Biz Rust Box",
      game: "rust",
      platformFamily: "PC",
      region: "US-East",
      tags: ["modded"],
      hostname: "play.example.com",
    });
    expect(biz.ownerAccountType).toBe("BUSINESS");
    expect(biz.publicationStatus).toBe("DRAFT");
    serverSlug = biz.slug;

    const inf = await createServer(influencerId, {
      name: "Inf MC",
      game: "minecraft-java",
      platformFamily: "PC",
      region: "EU-West",
      tags: [],
    });
    expect(inf.ownerAccountType).toBe("INFLUENCER");
  });

  it("isolates ownership by active account type", async () => {
    await switchActiveAccount(businessId, "INFLUENCER");
    const list = await listAccountServers(businessId);
    expect(list.every((s) => s.ownerAccountType === "INFLUENCER")).toBe(true);
    await expect(updateServer(businessId, serverSlug, { name: "Hijack" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await switchActiveAccount(businessId, "BUSINESS");
  });

  it("staff can suspend with a reason after publish", async () => {
    await submitForVerification(businessId, serverSlug);
    await staffModerateServer(staffId, serverSlug, { action: "approve" });
    await updateServer(businessId, serverSlug, { publicationStatus: "PUBLISHED" });
    const suspended = await staffModerateServer(staffId, serverSlug, {
      action: "suspend",
      reason: "Misleading join information",
    });
    expect(suspended.publicationStatus).toBe("SUSPENDED");
    const restored = await staffModerateServer(staffId, serverSlug, {
      action: "restore",
      reason: "Owner corrected listing",
    });
    expect(restored.publicationStatus).toBe("DRAFT");
    await staffModerateServer(staffId, serverSlug, { action: "approve" });
    await updateServer(businessId, serverSlug, { publicationStatus: "PUBLISHED" });
  });

  it("favourite toggle is idempotent on counts", async () => {
    const a = await toggleFavourite(playerId, serverSlug);
    expect(a.favourited).toBe(true);
    const b = await toggleFavourite(playerId, serverSlug);
    expect(b.favourited).toBe(false);
    expect(b.favouriteCount).toBe(a.favouriteCount - 1);
    const c = await toggleFavourite(playerId, serverSlug);
    expect(c.favourited).toBe(true);
    expect(c.favouriteCount).toBe(a.favouriteCount);
  });
});
