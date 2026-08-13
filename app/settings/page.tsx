import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge>Preview</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Account mode switching (Player / Business / Influencer) and KOBAID management arrive in
          Phases 3–4. Dark neon is the product default.
        </p>
      </div>
      <Card>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Technical light tokens may exist later for tooling, but KOBA ships dark-first.
        </CardDescription>
      </Card>
    </div>
  );
}
