/**
 * Ledger integration / concurrency tests.
 * Require a migrated PostgreSQL database and:
 *   KOBA_LEDGER_INTEGRATION=1
 *   DATABASE_URL=postgresql://...
 *
 * Without those, these tests are skipped — do not treat a skip as concurrency proof.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.KOBA_LEDGER_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("ledger integration", () => {
  let grantPromotionalCoins: typeof import("@/features/wallet/services/ledger.service").grantPromotionalCoins;
  let reserveCoins: typeof import("@/features/wallet/services/ledger.service").reserveCoins;
  let captureReservation: typeof import("@/features/wallet/services/ledger.service").captureReservation;
  let releaseReservation: typeof import("@/features/wallet/services/ledger.service").releaseReservation;
  let getWalletSummary: typeof import("@/features/wallet/services/ledger.service").getWalletSummary;
  let reconcileWallet: typeof import("@/features/wallet/services/ledger.service").reconcileWallet;
  let prisma: typeof import("@/lib/db").prisma;
  let userId: string;

  beforeAll(async () => {
    ({
      grantPromotionalCoins,
      reserveCoins,
      captureReservation,
      releaseReservation,
      getWalletSummary,
      reconcileWallet,
    } = await import("@/features/wallet/services/ledger.service"));
    ({ prisma } = await import("@/lib/db"));

    const user = await prisma.user.create({
      data: {
        email: `ledger-it-${Date.now()}@koba.local`,
        profile: { create: { handle: `ledger${Date.now()}`, activeAccountType: "PLAYER" } },
      },
    });
    userId = user.id;

    await grantPromotionalCoins({
      userId,
      amount: 500,
      memo: "integration promo",
      idempotencyKey: `it-promo-${userId}`,
    });
  });

  afterAll(async () => {
    if (!userId) return;
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("grants are idempotent", async () => {
    const first = await grantPromotionalCoins({
      userId,
      amount: 10,
      memo: "dup",
      idempotencyKey: `it-dup-${userId}`,
    });
    const second = await grantPromotionalCoins({
      userId,
      amount: 10,
      memo: "dup",
      idempotencyKey: `it-dup-${userId}`,
    });
    expect(second.publicRef).toBe(first.publicRef);
  });

  it("serialises competing reservations against available balance", async () => {
    const summary = await getWalletSummary(userId);
    const available = BigInt(summary.available);
    const half = available / 2n;
    if (half <= 0n) return;

    const results = await Promise.allSettled([
      reserveCoins({
        userId,
        amount: available,
        purpose: "race-a",
        idempotencyKey: `race-a-${userId}-${Date.now()}`,
      }),
      reserveCoins({
        userId,
        amount: available,
        purpose: "race-b",
        idempotencyKey: `race-b-${userId}-${Date.now()}`,
      }),
    ]);

    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it("captures once and rejects release after capture", async () => {
    await grantPromotionalCoins({
      userId,
      amount: 25,
      memo: "capture-fund",
      idempotencyKey: `it-capture-fund-${userId}`,
    });
    const reservation = await reserveCoins({
      userId,
      amount: 25,
      purpose: "capture-test",
      idempotencyKey: `it-rsv-capture-${userId}`,
    });
    const first = await captureReservation({
      userId,
      reservationPublicRef: reservation.publicRef,
      idempotencyKey: `it-cap-${userId}`,
    });
    const second = await captureReservation({
      userId,
      reservationPublicRef: reservation.publicRef,
      idempotencyKey: `it-cap-${userId}-retry`,
    });
    expect(first.status).toBe("CAPTURED");
    expect(second.status).toBe("CAPTURED");
    await expect(
      releaseReservation({
        userId,
        reservationPublicRef: reservation.publicRef,
        idempotencyKey: `it-rel-after-cap-${userId}`,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("reconciles projections to the ledger", async () => {
    const result = await reconcileWallet(userId);
    expect(result.summary.available).toBe(result.ledger.available);
  });
});
