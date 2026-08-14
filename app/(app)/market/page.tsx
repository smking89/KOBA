import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Marketplace",
};

export default function MarketPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge tone="live">Preview</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Marketplace</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Product listings, rarity cards, filters, and auctions arrive in Phase 5. This route
          reserves the IA from the design prototype.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Legendary monument kit", "Epic avatar decoration", "Relic profile effect"].map(
          (title) => (
            <Card key={title}>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Placeholder card — commerce logic not wired yet.</CardDescription>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
