import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Feed" };

export default function FeedPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge>Preview</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Social Feed</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Posts, stories, sponsored units, and ranking ship in Phase 10 / 12.
        </p>
      </div>
      <Card>
        <CardTitle>Foundation placeholder</CardTitle>
        <CardDescription>Infinite scroll and media uploads are not enabled yet.</CardDescription>
      </Card>
    </div>
  );
}
