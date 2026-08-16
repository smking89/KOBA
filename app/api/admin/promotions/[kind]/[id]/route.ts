import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { canStaffModeratePromotions } from "@/features/promotions/lib/access";
import { limitPromotion, readJsonBody } from "@/features/promotions/lib/session";
import { staffPromotionActionSchema } from "@/features/promotions/schemas/promotions.schemas";
import {
  staffMarkClickSuspicious,
  staffModerateAd,
  staffModerateAffiliateCampaign,
  staffSetCommissionStatus,
  staffSetInfluencerVerification,
  suspendPromoCode,
} from "@/features/promotions/services/moderation.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const session = await auth();
  if (!session?.user.id) return jsonPromotion({ error: "Unauthorized." }, 401);
  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot || !canStaffModeratePromotions(snapshot.identities.map((row) => row.accountType))) {
    return jsonPromotion({ error: "Forbidden." }, 403);
  }
  const limited = await limitPromotion(`admin-promo:${session.user.id}`, 40);
  if (limited) return limited;
  const { kind, id } = await context.params;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = staffPromotionActionSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid action." }, 400);
  try {
    if (kind === "campaigns") {
      if (
        parsed.data.action !== "approve" &&
        parsed.data.action !== "reject" &&
        parsed.data.action !== "suspend"
      ) {
        return jsonPromotion({ error: "Unsupported action." }, 400);
      }
      return jsonPromotion({
        campaign: await staffModerateAffiliateCampaign({
          actorUserId: session.user.id,
          campaignId: id,
          action: parsed.data.action,
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
        }),
      });
    }
    if (kind === "ads") {
      if (
        parsed.data.action !== "approve" &&
        parsed.data.action !== "reject" &&
        parsed.data.action !== "suspend"
      ) {
        return jsonPromotion({ error: "Unsupported action." }, 400);
      }
      return jsonPromotion({
        campaign: await staffModerateAd({
          actorUserId: session.user.id,
          campaignId: id,
          action: parsed.data.action,
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
        }),
      });
    }
    if (kind === "influencers") {
      const status =
        parsed.data.action === "verify"
          ? "VERIFIED"
          : parsed.data.action === "reject"
            ? "REJECTED"
            : parsed.data.action === "suspend"
              ? "SUSPENDED"
              : "UNVERIFIED";
      return jsonPromotion({
        profile: await staffSetInfluencerVerification({
          actorUserId: session.user.id,
          slug: id,
          status,
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
          payoutEligible: parsed.data.action === "verify",
        }),
      });
    }
    if (kind === "commissions") {
      const status =
        parsed.data.action === "reverse"
          ? "REVERSED"
          : parsed.data.action === "review"
            ? "UNDER_REVIEW"
            : parsed.data.action === "approve"
              ? "AVAILABLE"
              : null;
      if (!status) return jsonPromotion({ error: "Unsupported action." }, 400);
      return jsonPromotion({
        commission: await staffSetCommissionStatus({
          actorUserId: session.user.id,
          commissionId: id,
          status,
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
        }),
      });
    }
    if (kind === "promo-codes") {
      return jsonPromotion({ code: await suspendPromoCode(session.user.id, id, true) });
    }
    if (kind === "clicks") {
      return jsonPromotion({
        click: await staffMarkClickSuspicious(session.user.id, id, parsed.data.note ?? ""),
      });
    }
    return jsonPromotion({ error: "Unknown resource." }, 404);
  } catch (error) {
    return jsonPromotionError(error, "Could not apply staff action.");
  }
}
