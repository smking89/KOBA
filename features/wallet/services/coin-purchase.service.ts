import { prisma } from "@/lib/db";
import { getPublicEnv } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";
import { WalletError } from "@/features/wallet/lib/errors";
import { getCoinPackage } from "@/features/wallet/lib/coin-packages";
import { generateCoinPurchaseRef } from "@/features/wallet/lib/refs";
import { creditPurchasedCoins } from "@/features/wallet/services/ledger.service";

async function allocatePurchaseRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateCoinPurchaseRef();
    const clash = await prisma.coinPurchase.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new WalletError("Could not allocate a purchase reference.", "CONFLICT");
}

/**
 * Starts (or resumes, if the same idempotencyKey is retried) a Stripe
 * Checkout Session to buy a fixed Coin package. This is a plain charge —
 * no Connect, no transfer_data, no application fee: KOBA is the seller,
 * the money settles to and stays on KOBA's own Stripe balance permanently.
 * Coins are credited only once the webhook confirms payment (see
 * markCoinPurchasePaid), the same client-can't-fake-it trust model as
 * marketplace checkout.
 */
export async function createCoinPurchaseCheckout(
  userId: string,
  input: { packageId: string; idempotencyKey: string },
) {
  if (!isStripeConfigured()) {
    throw new WalletError("Stripe test mode is not configured.", "INVALID");
  }

  const pack = getCoinPackage(input.packageId);
  if (!pack) {
    throw new WalletError("Unknown Coin package.", "NOT_FOUND");
  }

  const existing = await prisma.coinPurchase.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    if (existing.userId !== userId) {
      throw new WalletError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.status === "PAID") {
      return { publicRef: existing.publicRef, url: null as string | null, status: existing.status };
    }
    if (existing.status !== "PENDING") {
      throw new WalletError("Idempotency key already used.", "CONFLICT");
    }
    if (existing.stripeCheckoutSessionId) {
      const session = await getStripe().checkout.sessions.retrieve(
        existing.stripeCheckoutSessionId,
      );
      if (session.url && session.status !== "expired") {
        return { publicRef: existing.publicRef, url: session.url, status: existing.status };
      }
    }
  }

  const publicRef = existing?.publicRef ?? (await allocatePurchaseRef());
  const purchase =
    existing ??
    (await prisma.coinPurchase.create({
      data: {
        publicRef,
        userId,
        packageId: pack.id,
        priceCents: pack.priceCents,
        coinAmount: pack.coinAmount,
        currency: "USD",
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
      },
    }));

  const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const appUrl = getPublicEnv().appUrl;

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: purchase.publicRef,
      ...(buyer?.email ? { customer_email: buyer.email } : {}),
      success_url: `${appUrl}/wallet?purchase=${purchase.publicRef}&checkout=success`,
      cancel_url: `${appUrl}/wallet?checkout=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: { name: `KOBA Coins — ${pack.label} (${pack.coinAmount} Coins)` },
          },
        },
      ],
      metadata: { kind: "coin_purchase", coinPurchaseRef: purchase.publicRef },
    },
    { idempotencyKey: `coin-purchase:${purchase.publicRef}` },
  );

  await prisma.coinPurchase.update({
    where: { id: purchase.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  if (!session.url) {
    throw new WalletError("Stripe did not return a checkout URL.", "INVALID");
  }

  return { publicRef: purchase.publicRef, url: session.url, status: purchase.status };
}

/**
 * Webhook-driven only (see features/payments/services/webhook.service.ts).
 * Idempotent: a retried webhook for an already-PAID purchase is a no-op.
 * Uses CoinPurchase.idempotencyKey as the ledger's own idempotency key, so
 * even a duplicate call into creditPurchasedCoins can never double-credit.
 */
export async function markCoinPurchasePaid(input: {
  sessionId: string;
  paymentIntentId: string | null;
}) {
  const purchase = await prisma.coinPurchase.findUnique({
    where: { stripeCheckoutSessionId: input.sessionId },
  });
  if (!purchase) {
    return null;
  }
  if (purchase.status === "PAID") {
    return purchase;
  }
  if (purchase.status !== "PENDING") {
    throw new WalletError("Coin purchase cannot be marked paid.", "CONFLICT");
  }

  const ledgerTx = await creditPurchasedCoins({
    userId: purchase.userId,
    amount: purchase.coinAmount,
    memo: `Coin purchase ${purchase.publicRef} (${purchase.packageId})`,
    idempotencyKey: purchase.idempotencyKey,
    externalRef: input.sessionId,
  });

  return prisma.coinPurchase.update({
    where: { id: purchase.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: input.paymentIntentId,
      ledgerTransactionRef: ledgerTx.publicRef,
    },
  });
}

export async function expireCoinPurchaseCheckout(sessionId: string) {
  const purchase = await prisma.coinPurchase.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
  });
  if (!purchase || purchase.status !== "PENDING") {
    return purchase;
  }
  return prisma.coinPurchase.update({
    where: { id: purchase.id },
    data: { status: "CANCELLED" },
  });
}

export async function listCoinPurchases(userId: string) {
  return prisma.coinPurchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
