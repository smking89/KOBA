import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicInfluencerProfile } from "@/features/promotions/services/profile.service";
import { notFound } from "next/navigation";

export const metadata = { title: "Creator" };

export default async function PublicInfluencerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicInfluencerProfile(slug);
  if (!profile) notFound();
  return (
    <div className="space-y-6">
      <Badge tone={profile.verificationStatus === "VERIFIED" ? "success" : "default"}>
        {profile.verificationStatus === "VERIFIED" ? "Verified creator" : "Creator"}
      </Badge>
      <h1 className="text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
      <p className="max-w-2xl text-muted">{profile.bio}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Clicks</CardTitle>
          <p className="mt-2 font-mono text-2xl">{profile.stats.clicks}</p>
        </Card>
        <Card>
          <CardTitle>Conversions</CardTitle>
          <p className="mt-2 font-mono text-2xl">{profile.stats.conversions}</p>
        </Card>
        <Card>
          <CardTitle>Active campaigns</CardTitle>
          <p className="mt-2 font-mono text-2xl">{profile.stats.activeCampaigns}</p>
        </Card>
      </div>
      <Card>
        <CardTitle>Categories</CardTitle>
        <CardDescription>{profile.categories.join(" · ") || "None listed"}</CardDescription>
      </Card>
    </div>
  );
}
