/**
 * Trading fee configuration. Default is zero until the owner approves a fee.
 * When non-zero, acceptance must reserve/capture via the KOBA Coins ledger.
 */
export type TradeFeeConfig = {
  /** Flat fee in Coin units charged to the acceptor on completion. */
  flatFeeCoins: bigint;
  enabled: boolean;
};

export const DEFAULT_TRADE_FEE: TradeFeeConfig = {
  flatFeeCoins: 0n,
  enabled: false,
};

export function resolveTradeFee(config?: Partial<TradeFeeConfig>): TradeFeeConfig {
  const flat = config?.flatFeeCoins ?? DEFAULT_TRADE_FEE.flatFeeCoins;
  const enabled = config?.enabled ?? flat > 0n;
  if (flat < 0n) {
    return DEFAULT_TRADE_FEE;
  }
  return { flatFeeCoins: flat, enabled: enabled && flat > 0n };
}
