import { auth } from "@/lib/auth";
import { TradeHub } from "@/features/trade/components/trade-hub";
import {
  listMyTradeable,
  listTradeableInventory,
} from "@/features/inventory/services/inventory.service";
import { listTradesForUser } from "@/features/trade/services/trade.service";

export const metadata = { title: "Trade" };

export default async function TradePage() {
  const session = await auth();
  const [listed, myInventory, initialTrades] = await Promise.all([
    listTradeableInventory({ limit: 48 }).catch(() => ({ items: [], nextCursor: null })),
    session?.user.id ? listMyTradeable(session.user.id).catch(() => []) : Promise.resolve([]),
    session?.user.id ? listTradesForUser(session.user.id).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <TradeHub
      initialTrades={initialTrades}
      listedInventory={listed.items}
      myInventory={myInventory}
    />
  );
}
