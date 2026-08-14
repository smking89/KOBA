import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "LFG" };

export default function LfgPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge>Preview</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Looking for Group</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Game, platform, region, skill, mic preference, and availability filters arrive in Phase 9.
        </p>
      </div>
      <Card>
        <CardTitle>Need 2 more for vanilla+ wipe</CardTitle>
        <CardDescription>Placeholder LFG post — matching logic not implemented.</CardDescription>
      </Card>
    </div>
  );
}
