import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge>Preview</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Groups</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Public/private groups, membership, and community roles ship in Phase 9.
        </p>
      </div>
      <Card>
        <CardTitle>Rust Legacy Raiders</CardTitle>
        <CardDescription>Example shell card — no live membership data yet.</CardDescription>
      </Card>
    </div>
  );
}
