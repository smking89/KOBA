import type { TradeState } from "@/features/trade/lib/types";

export type TradeAction =
  | "submit"
  | "accept"
  | "reject"
  | "cancel"
  | "counter"
  | "expire"
  | "complete"
  | "dispute"
  | "void";

const TRANSITIONS: Record<TradeAction, Partial<Record<TradeState, TradeState>>> = {
  submit: { DRAFT: "PENDING" },
  accept: { PENDING: "ACCEPTED", COUNTERED: "ACCEPTED" },
  reject: { PENDING: "REJECTED", COUNTERED: "REJECTED" },
  cancel: { PENDING: "CANCELLED", COUNTERED: "CANCELLED", DRAFT: "CANCELLED" },
  counter: { PENDING: "COUNTERED", COUNTERED: "COUNTERED" },
  expire: { PENDING: "EXPIRED", COUNTERED: "EXPIRED" },
  complete: { ACCEPTED: "COMPLETED" },
  dispute: { COMPLETED: "DISPUTED", PENDING: "DISPUTED" },
  void: { PENDING: "VOIDED", COUNTERED: "VOIDED", ACCEPTED: "VOIDED", DRAFT: "VOIDED" },
};

export function nextTradeState(current: TradeState, action: TradeAction): TradeState {
  const next = TRANSITIONS[action]?.[current];
  if (!next) {
    throw new Error(`INVALID_TRANSITION:${current}:${action}`);
  }
  return next;
}

export function canActorPerform(
  action: TradeAction,
  role: "proposer" | "counterparty" | "system" | "staff",
): boolean {
  switch (action) {
    case "accept":
    case "reject":
      return role === "counterparty";
    case "cancel":
      return role === "proposer" || role === "staff";
    case "counter":
      return role === "counterparty";
    case "submit":
      return role === "proposer";
    case "expire":
    case "complete":
      return role === "system" || role === "staff" || role === "counterparty";
    case "dispute":
      return role === "proposer" || role === "counterparty" || role === "staff";
    case "void":
      return role === "staff";
    default:
      return false;
  }
}
