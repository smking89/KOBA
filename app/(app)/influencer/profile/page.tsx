import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { getInfluencerProfile } from "@/features/promotions/services/profile.service";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";
import { ActionButton, ProfileForm } from "@/features/promotions/components/promotion-forms";

export const metadata = { title: "Influencer profile" };

export default async function InfluencerProfilePage() {
  const { snapshot } = await requireInfluencerDashboard("/influencer/profile");
  const profile = await getInfluencerProfile(snapshot.userId);
  return (
    <div className="space-y-6">
      <div>
        <Badge tone="live">Influencer</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Public profile</h1>
      </div>
      <InfluencerPromotionsNav current="/influencer/profile" />
      <Card>
        <CardTitle>Status</CardTitle>
        <CardDescription>
          {profile.verificationStatus}
          {profile.payoutEligible ? " · payout eligible" : " · payout not eligible"}
        </CardDescription>
        <div className="mt-3">
          <ActionButton
            url="/api/influencer/profile"
            body={{}}
            label="Request staff verification"
          />
        </div>
      </Card>
      <Card>
        <CardTitle>Edit profile</CardTitle>
        <CardDescription>
          Contact email stays private. Staff verify identity separately.
        </CardDescription>
        <div className="mt-4">
          <ProfileForm
            initial={{
              displayName: profile.displayName,
              bio: profile.bio,
              contactEmail: profile.contactEmail,
              games: profile.games,
              categories: profile.categories,
              audienceRegions: profile.audienceRegions,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
