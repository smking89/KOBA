import { auth } from "@/lib/auth";
import { TradeHub } from "@/features/trade/components/trade-hub";
import { listTradesForUser } from "@/features/trade/services/trade.service";

export const metadata = { title: "Trade" };

export default async function TradePage() {
  const session = await auth();
  const initialTrades = session?.user.id ? await listTradesForUser(session.user.id) : [];
  return <TradeHub initialTrades={initialTrades} />;
}
