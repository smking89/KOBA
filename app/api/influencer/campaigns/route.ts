import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { requireSignedIn } from "@/features/promotions/lib/session";
import { listInfluencerParticipations } from "@/features/promotions/services/participation.service";
import { listOpenCampaignsForInfluencer } from "@/features/promotions/services/campaign.service";
import { listPromotionNotices } from "@/features/promotions/services/events.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    const [participations, open, notices] = await Promise.all([
      listInfluencerParticipations(session.userId),
      listOpenCampaignsForInfluencer(),
      listPromotionNotices(session.userId),
    ]);
    return jsonPromotion({ participations, open, notices });
  } catch (error) {
    return jsonPromotionError(error, "Could not load campaigns.");
  }
}
