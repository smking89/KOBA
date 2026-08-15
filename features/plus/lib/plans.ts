import { approvedEntitlementCodes } from "@/features/plus/lib/entitlements";
import { PlusError } from "@/features/plus/lib/errors";
import type { PlusPlanInterval } from "@/features/plus/lib/types";

export const PLUS_PLAN_CODES = ["KOBA_PLUS_MONTHLY", "KOBA_PLUS_ANNUAL"] as const;
export type PlusPlanCode = (typeof PLUS_PLAN_CODES)[number];

function isPlaceholderPrice(value: string | undefined): boolean {
  if (!value) return true;
  return value.includes("replace") || !value.startsWith("price_");
}

export type PlusPlanConfig = {
  code: PlusPlanCode;
  displayName: string;
  interval: PlusPlanInterval;
  stripePriceId: string | null;
  currency: string;
  displayAmountCents: number;
  sortOrder: number;
  entitlements: string[];
};

export function plusPlanConfigs(): PlusPlanConfig[] {
  const currency = (process.env.STRIPE_PLUS_CURRENCY ?? "usd").toLowerCase();
  const monthlyPrice = process.env.STRIPE_PRICE_PLUS_MONTHLY;
  const annualPrice = process.env.STRIPE_PRICE_PLUS_ANNUAL;
  return [
    {
      code: "KOBA_PLUS_MONTHLY",
      displayName: "KOBA Plus Monthly",
      interval: "MONTHLY",
      stripePriceId: isPlaceholderPrice(monthlyPrice) ? null : monthlyPrice!,
      currency,
      displayAmountCents: Number.parseInt(
        process.env.STRIPE_PLUS_MONTHLY_AMOUNT_CENTS ?? "799",
        10,
      ),
      sortOrder: 1,
      entitlements: approvedEntitlementCodes(),
    },
    {
      code: "KOBA_PLUS_ANNUAL",
      displayName: "KOBA Plus Annual",
      interval: "ANNUAL",
      stripePriceId: isPlaceholderPrice(annualPrice) ? null : annualPrice!,
      currency,
      displayAmountCents: Number.parseInt(
        process.env.STRIPE_PLUS_ANNUAL_AMOUNT_CENTS ?? "7188",
        10,
      ),
      sortOrder: 2,
      entitlements: approvedEntitlementCodes(),
    },
  ];
}

export function findPlanConfig(code: string): PlusPlanConfig | undefined {
  return plusPlanConfigs().find((plan) => plan.code === code);
}

export function assertApprovedPlanCode(code: string): PlusPlanCode {
  if (!PLUS_PLAN_CODES.includes(code as PlusPlanCode)) {
    throw new PlusError("Unknown Plus plan.", "INVALID");
  }
  return code as PlusPlanCode;
}

export function formatDisplayPrice(cents: number, currency: string, interval: PlusPlanInterval) {
  const amount = (cents / 100).toFixed(2);
  const suffix = interval === "ANNUAL" ? "year" : "month";
  return `${currency.toUpperCase()} ${amount} / ${suffix}`;
}
