/** Safe integer Coin amounts — never use floating point for money. */

export type CoinAmount = bigint;

export function parseCoinAmount(value: unknown): CoinAmount {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      throw new Error("Coin amount must be a positive integer.");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error("Coin amount must be a positive safe integer.");
    }
    return BigInt(value);
  }
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) {
    const parsed = BigInt(value);
    if (parsed <= 0n) {
      throw new Error("Coin amount must be a positive integer.");
    }
    return parsed;
  }
  throw new Error("Invalid coin amount.");
}

export function assertPositiveCoinAmount(amount: CoinAmount): void {
  if (amount <= 0n) {
    throw new Error("Coin amount must be a positive integer.");
  }
}

export function coinAmountToString(amount: CoinAmount): string {
  return amount.toString();
}

export function coinAmountToNumberSafe(amount: CoinAmount): number {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Coin amount exceeds safe JavaScript number range.");
  }
  return Number(amount);
}
