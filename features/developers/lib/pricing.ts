import { parseCoinAmount, type CoinAmount } from "@/features/wallet/lib/amounts";
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_VERIFIED_COMMISSION_BPS,
  parseCommissionBps,
} from "@/features/payments/lib/money";

export function developerCommissionBps(verified: boolean): number {
  if (verified) {
    return parseCommissionBps(
      process.env.KOBA_DEV_COMMISSION_BPS_VERIFIED,
      parseCommissionBps(process.env.KOBA_COMMISSION_BPS_VERIFIED, DEFAULT_VERIFIED_COMMISSION_BPS),
    );
  }
  return parseCommissionBps(
    process.env.KOBA_DEV_COMMISSION_BPS,
    parseCommissionBps(process.env.KOBA_COMMISSION_BPS, DEFAULT_COMMISSION_BPS),
  );
}

export function splitCoinPurchase(
  priceCoins: CoinAmount,
  commissionBps: number,
): {
  priceCoins: CoinAmount;
  feeCoins: CoinAmount;
  sellerCoins: CoinAmount;
} {
  if (priceCoins <= 0n) {
    return { priceCoins, feeCoins: 0n, sellerCoins: 0n };
  }
  const fee = commissionBps <= 0 ? 0n : (priceCoins * BigInt(commissionBps)) / 10_000n;
  const capped = fee > priceCoins ? priceCoins : fee;
  return { priceCoins, feeCoins: capped, sellerCoins: priceCoins - capped };
}

export function parsePriceCoins(value: unknown): CoinAmount {
  return parseCoinAmount(value);
}
