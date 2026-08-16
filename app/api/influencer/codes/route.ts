import { jsonInfluencer, jsonInfluencerError } from "@/features/influencer/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import {
  limitInfluencer,
  readJsonBody,
  requireInfluencerSession,
} from "@/features/influencer/lib/session";
import { createReferralCodeSchema } from "@/features/influencer/schemas/influencer.schemas";
import {
  createReferralCode,
  getInfluencerDashboard,
} from "@/features/influencer/services/influencer.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireInfluencerSession();
  if (!session.ok) return session.response;
  try {
    return jsonInfluencer({ dashboard: await getInfluencerDashboard(session.userId) });
  } catch (error) {
    return jsonInfluencerError(error, "Could not load influencer dashboard.");
  }
}

export async function POST(request: Request) {
  const session = await requireInfluencerSession();
  if (!session.ok) return session.response;
  const limited = await limitInfluencer(`inf-code:${session.userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createReferralCodeSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonInfluencer({ error: "Invalid product." }, 400);
  try {
    const code = await createReferralCode(session.userId, parsed.data, clientIp(request));
    return jsonInfluencer(code, 201);
  } catch (error) {
    return jsonInfluencerError(error, "Could not create referral code.");
  }
}
