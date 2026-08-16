/**
 * Rust integration auth tests — require migrated Postgres:
 *   KOBA_SERVER_INTEGRATION=1
 *   DATABASE_URL=postgresql://...
 *   KOBA_CREDENTIAL_ENCRYPTION_KEY=<32-byte base64>
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.KOBA_SERVER_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("rust integration authorisation", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let createServer: typeof import("@/features/servers/services/server.service").createServer;
  let testRustConnection: typeof import("@/features/servers/services/integration.service").testRustConnection;
  let getRustIntegration: typeof import("@/features/servers/services/integration.service").getRustIntegration;
  let connectRustIntegration: typeof import("@/features/servers/services/integration.service").connectRustIntegration;

  let playerId: string;
  let businessId: string;
  let influencerId: string;
  let staffId: string;
  let otherBizId: string;
  let businessSlug: string;
  let influencerSlug: string;

  beforeAll(async () => {
    process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY ??= Buffer.alloc(32, 3).toString("base64");
    process.env.KOBA_CREDENTIAL_KEY_VERSION ??= "1";
    ({ prisma } = await import("@/lib/db"));
    ({ createServer } = await import("@/features/servers/services/server.service"));
    ({ testRustConnection, getRustIntegration, connectRustIntegration } =
      await import("@/features/servers/services/integration.service"));

    const stamp = Date.now();
    const player = await prisma.user.create({
      data: {
        email: `rcon-pl-${stamp}@koba.local`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUV",
        profile: { create: { handle: `rconpl${stamp}`, activeAccountType: "PLAYER" } },
        kobaIdentities: {
          create: {
            code: `KBA-RPL-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "PLAYER",
          },
        },
      },
    });
    const business = await prisma.user.create({
      data: {
        email: `rcon-bz-${stamp}@koba.local`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUV",
        profile: { create: { handle: `rconbz${stamp}`, activeAccountType: "BUSINESS" } },
        kobaIdentities: {
          create: {
            code: `KBA-RBZ-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "BUSINESS",
          },
        },
      },
    });
    const influencer = await prisma.user.create({
      data: {
        email: `rcon-if-${stamp}@koba.local`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUV",
        profile: { create: { handle: `rconif${stamp}`, activeAccountType: "INFLUENCER" } },
        kobaIdentities: {
          create: {
            code: `KBA-RIF-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "INFLUENCER",
          },
        },
      },
    });
    const staff = await prisma.user.create({
      data: {
        email: `rcon-st-${stamp}@koba.local`,
        profile: { create: { handle: `rconst${stamp}`, activeAccountType: "ADMIN" } },
        kobaIdentities: {
          create: {
            code: `KBA-RAD-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "ADMIN",
          },
        },
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `rcon-ob-${stamp}@koba.local`,
        profile: { create: { handle: `rconob${stamp}`, activeAccountType: "BUSINESS" } },
        kobaIdentities: {
          create: {
            code: `KBA-ROB-${stamp.toString(16).slice(-8).toUpperCase()}`,
            accountType: "BUSINESS",
          },
        },
      },
    });
    playerId = player.id;
    businessId = business.id;
    influencerId = influencer.id;
    staffId = staff.id;
    otherBizId = other.id;

    const owned = await createServer(businessId, {
      name: `Rust Biz ${stamp}`,
      game: "rust",
      platformFamily: "PC",
      region: "EU",
      tags: [],
      hostname: "203.0.113.10",
      queryPort: 28015,
      gamePort: 28015,
    });
    businessSlug = owned.slug;
    const inf = await createServer(influencerId, {
      name: `Rust Inf ${stamp}`,
      game: "rust",
      platformFamily: "PC",
      region: "EU",
      tags: [],
    });
    influencerSlug = inf.slug;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.gameServer.deleteMany({
      where: { ownerUserId: { in: [businessId, influencerId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [playerId, businessId, influencerId, staffId, otherBizId] } },
    });
  });

  it("rejects players and the wrong account", async () => {
    await expect(getRustIntegration(playerId, businessSlug)).rejects.toThrow(
      /Business or Influencer/,
    );
    await expect(getRustIntegration(otherBizId, businessSlug)).rejects.toThrow(/owning/);
  });

  it("allows the Business owner to read health without credentials", async () => {
    const health = await getRustIntegration(businessId, businessSlug);
    expect(health.credentialsConfigured).toBe(false);
    expect(health.readOnly).toBe(true);
    expect(JSON.stringify(health)).not.toMatch(/password|ciphertext|authTag/i);
  });

  it("allows the Influencer owner to read their own health", async () => {
    const health = await getRustIntegration(influencerId, influencerSlug);
    expect(health.mode).toBe("RCON_READ");
    expect(health.administrativeCommandsEnabled).toBe(false);
  });

  it("lets staff inspect health but never decrypts credentials", async () => {
    const health = await getRustIntegration(staffId, businessSlug, { staffInspect: true });
    expect(health.credentialsConfigured).toBe(false);
    expect(JSON.stringify(health)).not.toMatch(/password|ciphertext/i);
  });

  it("rejects private and loopback targets before connect", async () => {
    await expect(
      testRustConnection(businessId, businessSlug, {
        hostname: "127.0.0.1",
        rconPort: 28016,
        password: "nope",
      }),
    ).rejects.toThrow(/not allowed|blocked|Host/i);
    await expect(
      testRustConnection(businessId, businessSlug, {
        hostname: "10.1.2.3",
        rconPort: 28016,
        password: "nope",
      }),
    ).rejects.toThrow();
  });

  it("does not store credentials when connect is unauthorised", async () => {
    await expect(
      connectRustIntegration(playerId, businessSlug, {
        hostname: "203.0.113.10",
        rconPort: 28016,
        password: "secret",
        accountPassword: "irrelevant",
      }),
    ).rejects.toThrow();
    const creds = await prisma.serverCredential.findMany({
      where: { server: { slug: businessSlug } },
    });
    expect(creds).toHaveLength(0);
  });
});
