import { jsonInfluencer, jsonInfluencerError } from "@/features/influencer/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import { requireInfluencerSession } from "@/features/influencer/lib/session";
import { revokeReferralCode } from "@/features/influencer/services/influencer.service";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ code: string }> }) {
  const session = await requireInfluencerSession();
  if (!session.ok) return session.response;
  const { code } = await context.params;
  try {
    return jsonInfluencer(await revokeReferralCode(session.userId, code, clientIp(request)));
  } catch (error) {
    return jsonInfluencerError(error, "Could not revoke referral code.");
  }
}
