import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeveloperError } from "@/features/developers/lib/errors";
import { WalletError } from "@/features/wallet/lib/errors";

const {
  prisma,
  spendCoinsSplit,
  reverseTransaction,
  staffAdjustCoins,
  writeAuditLog,
  enqueueWebhookEvent,
} = vi.hoisted(() => {
  const profiles = new Map<string, Record<string, unknown>>();
  const members = new Map<string, Record<string, unknown>>();
  const apps = new Map<string, Record<string, unknown>>();
  const keys = new Map<string, Record<string, unknown>>();
  const products = new Map<string, Record<string, unknown>>();
  const entitlements = new Map<string, Record<string, unknown>>();
  const purchases = new Map<string, Record<string, unknown>>();
  const wallets = new Map<string, { userId: string; earnedBalance: bigint }>();

  return {
    profiles,
    members,
    apps,
    keys,
    products,
    entitlements,
    purchases,
    wallets,
    writeAuditLog: vi.fn(async () => undefined),
    enqueueWebhookEvent: vi.fn(async () => ({ queued: 0 })),
    spendCoinsSplit: vi.fn(async () => ({
      publicRef: "KOBA-LED-1",
      status: "POSTED",
      duplicate: false,
    })),
    reverseTransaction: vi.fn(async () => ({ publicRef: "KOBA-LED-R", status: "REVERSED" })),
    staffAdjustCoins: vi.fn(async () => ({ publicRef: "KOBA-LED-A" })),
    prisma: {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "staff") {
            return { kobaIdentities: [{ accountType: "ADMIN" }] };
          }
          if (where.id === "buyer" || where.id === "seller" || where.id === "dev") {
            return {
              id: where.id,
              email: `${where.id}@koba.test`,
              profile: { activeAccountType: "PLAYER" },
              kobaIdentities: [{ id: `kid-${where.id}`, accountType: "PLAYER", code: "P1" }],
            };
          }
          return {
            id: where.id,
            email: `${where.id}@koba.test`,
            profile: { activeAccountType: "PLAYER" },
            kobaIdentities: [{ id: `kid-${where.id}`, accountType: "PLAYER", code: "P1" }],
          };
        }),
      },
      developerProfile: {
        findFirst: vi.fn(
          async ({ where }: { where: { OR?: { slug?: string; ownerUserId?: string }[] } }) => {
            return (
              [...profiles.values()].find((row) =>
                where.OR?.some(
                  (clause) => row.slug === clause.slug || row.ownerUserId === clause.ownerUserId,
                ),
              ) ?? null
            );
          },
        ),
        findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
          return (
            [...profiles.values()].find((row) => row.slug === where.slug || row.id === where.id) ??
            null
          );
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: "prof_1", verified: false, suspendedAt: null, ...data };
          profiles.set("prof_1", row);
          members.set("prof_1:dev", {
            profileId: "prof_1",
            userId: "dev",
            role: "OWNER",
            profile: row,
          });
          return row;
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = profiles.get(where.id);
            if (!row) throw new Error("missing");
            Object.assign(row, data);
            return row;
          },
        ),
      },
      developerMember: {
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => {
          return [...members.values()].find((row) => row.userId === where.userId) ?? null;
        }),
        findUnique: vi.fn(
          async ({
            where,
          }: {
            where: { profileId_userId: { profileId: string; userId: string } };
          }) => {
            const key = `${where.profileId_userId.profileId}:${where.profileId_userId.userId}`;
            return members.get(key) ?? null;
          },
        ),
      },
      developerApplication: {
        findUnique: vi.fn(async ({ where }: { where: { publicRef: string } }) => {
          const row = [...apps.values()].find((app) => app.publicRef === where.publicRef);
          if (!row) return null;
          return { ...row, profile: profiles.get(String(row.profileId)) };
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: "app_1", status: "ACTIVE", productionApprovedAt: null, ...data };
          apps.set("app_1", row);
          return row;
        }),
      },
      developerApiKey: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `key_${keys.size}`, revokedAt: null, lastUsedAt: null, ...data };
          keys.set(String(data.prefix), row);
          return row;
        }),
        findUnique: vi.fn(async ({ where }: { where: { prefix: string } }) => {
          const row = keys.get(where.prefix);
          if (!row) return null;
          const app = apps.get(String(row.applicationId)) ?? [...apps.values()][0];
          return {
            ...row,
            application: {
              ...app,
              profile: profiles.get(String(app?.profileId)) ?? { suspendedAt: null },
            },
          };
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = [...keys.values()].find((item) => item.id === where.id);
            if (row) Object.assign(row, data);
            return row;
          },
        ),
      },
      devProduct: {
        findFirst: vi.fn(
          async ({ where }: { where: { OR?: { slug?: string; publicRef?: string }[] } }) => {
            return (
              [...products.values()].find((row) =>
                where.OR?.some(
                  (clause) => row.slug === clause.slug || row.publicRef === clause.publicRef,
                ),
              ) ?? null
            );
          },
        ),
        findUnique: vi.fn(async ({ where }: { where: { slug?: string; publicRef?: string } }) => {
          return (
            [...products.values()].find(
              (row) => row.slug === where.slug || row.publicRef === where.publicRef,
            ) ?? null
          );
        }),
      },
      devEntitlement: {
        findUnique: vi.fn(
          async ({
            where,
          }: {
            where: { userId_productId: { userId: string; productId: string } };
          }) => {
            return (
              entitlements.get(
                `${where.userId_productId.userId}:${where.userId_productId.productId}`,
              ) ?? null
            );
          },
        ),
        findFirst: vi.fn(async () => null),
        upsert: vi.fn(
          async ({
            where,
            create,
          }: {
            where: { userId_productId: { userId: string; productId: string } };
            create: Record<string, unknown>;
          }) => {
            const key = `${where.userId_productId.userId}:${where.userId_productId.productId}`;
            const row = { id: key, revokedAt: null, ...create };
            entitlements.set(key, row);
            return row;
          },
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { userId: string; productId: string };
            data: Record<string, unknown>;
          }) => {
            const key = `${where.userId}:${where.productId}`;
            const row = entitlements.get(key);
            if (row) Object.assign(row, data);
            return { count: row ? 1 : 0 };
          },
        ),
      },
      devPurchase: {
        findUnique: vi.fn(
          async ({ where }: { where: { idempotencyKey?: string; publicRef?: string } }) => {
            if (where.idempotencyKey) {
              return (
                [...purchases.values()].find(
                  (row) => row.idempotencyKey === where.idempotencyKey,
                ) ?? null
              );
            }
            return [...purchases.values()].find((row) => row.publicRef === where.publicRef) ?? null;
          },
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: { buyerUserId: string; productId: string; status: string };
          }) => {
            return (
              [...purchases.values()].find(
                (row) =>
                  row.buyerUserId === where.buyerUserId &&
                  row.productId === where.productId &&
                  row.status === where.status,
              ) ?? null
            );
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: `pur_${purchases.size}`,
            createdAt: new Date(),
            proceedsUnrecoverable: false,
            refundReason: null,
            ...data,
          };
          purchases.set(String(row.id), row);
          return row;
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = purchases.get(where.id);
            if (!row) throw new Error("missing purchase");
            Object.assign(row, data);
            return row;
          },
        ),
      },
      devInstall: {
        upsert: vi.fn(async () => ({ id: "inst_1" })),
      },
      coinWallet: {
        findUnique: vi.fn(
          async ({ where }: { where: { userId: string } }) => wallets.get(where.userId) ?? null,
        ),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      $transaction: vi.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
        return ops;
      }),
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/features/auth/services/audit-log.service", () => ({ writeAuditLog }));
vi.mock("@/features/developers/services/webhook.service", () => ({ enqueueWebhookEvent }));
vi.mock("@/features/wallet/services/ledger.service", () => ({
  spendCoinsSplit,
  reverseTransaction,
  staffAdjustCoins,
}));

import {
  createDeveloperProfile,
  createDeveloperApplication,
  createDeveloperApiKey,
  authenticateApiKey,
} from "@/features/developers/services/portal.service";
import {
  purchaseProduct,
  refundDeveloperPurchase,
} from "@/features/developers/services/purchase.service";
import { upsertProductReview } from "@/features/developers/services/review.service";

describe("developer portal services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a publisher and rejects production apps from developers", async () => {
    const profile = await createDeveloperProfile("dev", {
      displayName: "Oxide Labs",
      slug: "oxide-labs",
      description: "",
      contactEmail: "dev@koba.test",
      games: [],
      platforms: [],
    });
    expect(profile.slug).toBe("oxide-labs");
    expect(profile).not.toHaveProperty("contactEmail");

    await expect(
      createDeveloperApplication("dev", {
        name: "Live bot",
        description: "",
        environment: "PRODUCTION",
        scopes: ["profile:read"],
        redirectUris: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reveals an API key once and authenticates against the hash", async () => {
    prisma.developerMember.findFirst.mockResolvedValueOnce({
      role: "OWNER",
      profileId: "prof_1",
      profile: {
        id: "prof_1",
        slug: "oxide-labs",
        displayName: "Oxide",
        description: "",
        avatarUrl: null,
        bannerUrl: null,
        websiteUrl: null,
        supportUrl: null,
        privacyUrl: null,
        termsUrl: null,
        verified: false,
        suspendedAt: null,
        games: [],
        platforms: [],
        contactEmail: "dev@koba.test",
      },
    } as never);
    prisma.developerApplication.findUnique.mockResolvedValueOnce({
      id: "app_1",
      publicRef: "KOBA-DAPP-AAAABBBB",
      profileId: "prof_1",
      status: "ACTIVE",
      environment: "SANDBOX",
      scopes: ["profile:read"],
      productionApprovedAt: null,
      profile: { suspendedAt: null },
    } as never);
    const created = await createDeveloperApiKey("dev", {
      applicationRef: "KOBA-DAPP-AAAABBBB",
      name: "ci",
      scopes: ["profile:read"],
    });
    expect(created.revealedOnce).toBe(true);
    expect(created.secret.startsWith("koba_sandbox_")).toBe(true);

    prisma.developerApiKey.findUnique.mockResolvedValueOnce({
      id: "key_1",
      prefix: created.prefix,
      secretHash: (await import("@/features/developers/lib/api-keys")).hashApiKeySecret(
        created.secret,
      ),
      revokedAt: null,
      expiresAt: null,
      scopes: ["profile:read"],
      environment: "SANDBOX",
      application: {
        status: "ACTIVE",
        profile: { suspendedAt: null, slug: "oxide-labs", displayName: "Oxide", verified: false },
      },
    } as never);
    const authed = await authenticateApiKey(created.secret);
    expect(authed.prefix).toBe(created.prefix);
  });

  it("rejects expired keys", async () => {
    prisma.developerApiKey.findUnique.mockResolvedValueOnce({
      id: "key_exp",
      prefix: "koba_sandbox_aaaaaaaaaaaa",
      secretHash: "00",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      application: { status: "ACTIVE", profile: { suspendedAt: null } },
    } as never);
    await expect(authenticateApiKey("koba_sandbox_aaaaaaaaaaaa_secret")).rejects.toBeInstanceOf(
      DeveloperError,
    );
  });
});

describe("purchases and reviews", () => {
  const published = {
    id: "prod_1",
    slug: "raid-sync",
    publicRef: "KOBA-DEV-AAAABBBB",
    ownerUserId: "seller",
    reviewState: "PUBLISHED",
    suspendedAt: null,
    pricing: "PAID",
    priceCoins: 40n,
    profile: { ownerUserId: "seller", verified: false },
  };

  it("creates a free entitlement without spending coins", async () => {
    prisma.devProduct.findFirst.mockResolvedValueOnce({
      ...published,
      pricing: "FREE",
      priceCoins: 0n,
    });
    prisma.devEntitlement.findUnique.mockResolvedValueOnce(null);
    prisma.devPurchase.findFirst.mockResolvedValueOnce(null);
    const result = await purchaseProduct("buyer", "raid-sync", "idem-free-01");
    expect(result.priceCoins).toBe("0");
    expect(spendCoinsSplit).not.toHaveBeenCalled();
  });

  it("charges the authoritative paid price and snapshots the fee", async () => {
    prisma.devProduct.findFirst.mockResolvedValueOnce(published);
    prisma.devEntitlement.findUnique.mockResolvedValueOnce(null);
    prisma.devPurchase.findFirst.mockResolvedValueOnce(null);
    prisma.devPurchase.findUnique.mockResolvedValueOnce(null);
    const result = await purchaseProduct("buyer", "raid-sync", "idem-paid-01");
    expect(spendCoinsSplit).toHaveBeenCalled();
    expect(result.priceCoins).toBe("40");
    expect(Number(result.feeCoins) + Number(result.sellerCoins)).toBe(40);
  });

  it("rejects insufficient coins", async () => {
    prisma.devProduct.findFirst.mockResolvedValueOnce(published);
    prisma.devEntitlement.findUnique.mockResolvedValueOnce(null);
    prisma.devPurchase.findFirst.mockResolvedValueOnce(null);
    prisma.devPurchase.findUnique.mockResolvedValueOnce(null);
    spendCoinsSplit.mockRejectedValueOnce(
      new WalletError("Insufficient KOBA Coins available.", "INSUFFICIENT"),
    );
    await expect(purchaseProduct("buyer", "raid-sync", "idem-paid-02")).rejects.toMatchObject({
      code: "INSUFFICIENT",
    });
  });

  it("rejects duplicate ownership and self-purchase", async () => {
    prisma.devProduct.findFirst.mockResolvedValueOnce(published);
    prisma.devEntitlement.findUnique.mockResolvedValueOnce({ revokedAt: null });
    await expect(purchaseProduct("buyer", "raid-sync", "idem-dup-01")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    prisma.devProduct.findFirst.mockResolvedValueOnce(published);
    await expect(purchaseProduct("seller", "raid-sync", "idem-self-01")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refunds with ledger reversal when seller proceeds remain", async () => {
    prisma.devPurchase.findUnique.mockResolvedValueOnce({
      id: "pur_1",
      publicRef: "KOBA-DPUR-AAAABBBB",
      status: "PAID",
      priceCoins: 40n,
      sellerCoins: 37n,
      captureTxRef: "KOBA-LED-1",
      buyerUserId: "buyer",
      productId: "prod_1",
      product: { ownerUserId: "seller", slug: "raid-sync" },
      commissionBps: 800,
      feeCoins: 3n,
      proceedsUnrecoverable: false,
      refundReason: null,
      createdAt: new Date(),
    });
    prisma.coinWallet.findUnique.mockResolvedValueOnce({ userId: "seller", earnedBalance: 37n });
    const result = await refundDeveloperPurchase("staff", "KOBA-DPUR-AAAABBBB", "duplicate charge");
    expect(reverseTransaction).toHaveBeenCalled();
    expect(result.status).toBe("REFUNDED");
  });

  it("rejects self-review and reviews without entitlement", async () => {
    prisma.devProduct.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      slug: "raid-sync",
      ownerUserId: "seller",
    });
    await expect(
      upsertProductReview("seller", "raid-sync", { rating: 5, body: "mine" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    prisma.devProduct.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      slug: "raid-sync",
      ownerUserId: "seller",
    });
    prisma.devEntitlement.findUnique.mockResolvedValueOnce(null);
    await expect(
      upsertProductReview("buyer", "raid-sync", { rating: 5, body: "nice" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
