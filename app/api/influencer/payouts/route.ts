import { jsonInfluencer, jsonInfluencerError } from "@/features/influencer/lib/http";
import {
  getInfluencerPayoutStatus,
  refreshInfluencerPayoutAccount,
  startInfluencerPayoutOnboarding,
} from "@/features/influencer/services/payout.service";
import { limitInfluencer, requireInfluencerSession } from "@/features/influencer/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireInfluencerSession();
  if (!session.ok) return session.response;
  try {
    return jsonInfluencer(await getInfluencerPayoutStatus(session.userId));
  } catch (error) {
    return jsonInfluencerError(error, "Could not load payout status.");
  }
}

export async function POST() {
  const session = await requireInfluencerSession();
  if (!session.ok) return session.response;
  const limited = await limitInfluencer(`inf-payout:${session.userId}`, 8);
  if (limited) return limited;
  try {
    return jsonInfluencer(await startInfluencerPayoutOnboarding(session.userId));
  } catch (error) {
    return jsonInfluencerError(error, "Could not start payout onboarding.");
  }
}

export async function PATCH() {
  const session = await requireInfluencerSession();
  if (!session.ok) return session.response;
  try {
    const account = await refreshInfluencerPayoutAccount(session.userId);
    return jsonInfluencer({
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
    });
  } catch (error) {
    return jsonInfluencerError(error, "Could not refresh payout account.");
  }
}
