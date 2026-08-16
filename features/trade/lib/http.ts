import { NextResponse } from "next/server";
import { TradeError, tradeErrorStatus } from "@/features/trade/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonTradeError(error: unknown, fallback = "Could not complete trade action.") {
  if (error instanceof TradeError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: tradeErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
