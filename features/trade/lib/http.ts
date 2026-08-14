import { NextResponse } from "next/server";
import { TradeError, tradeErrorStatus } from "@/features/trade/lib/errors";

export function jsonTradeError(error: unknown, fallback = "Could not complete trade action.") {
  if (error instanceof TradeError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: tradeErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
