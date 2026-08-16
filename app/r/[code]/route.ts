import { NextResponse } from "next/server";
import {
  recordReferralClick,
  resolvePublicReferral,
} from "@/features/influencer/services/influencer.service";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS } from "@/features/influencer/lib/types";
import {
  recordCampaignReferralClick,
  resolveCampaignReferral,
} from "@/features/promotions/services/attribution.service";
import { ATTRIBUTION_COOKIE } from "@/features/promotions/lib/tokens";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { promoGuessLimit } from "@/features/promotions/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const raw = decodeURIComponent(code);
  const ip = clientIp(request);
  const limited = await rateLimit(
    `ref-guess:${ip ?? "unknown"}`,
    promoGuessLimit(),
    15 * 60 * 1000,
  );
  if (!limited.success) {
    return NextResponse.redirect(new URL("/market", request.url), 303);
  }

  if (raw.startsWith("kref_")) {
    const resolved = await resolveCampaignReferral(raw).catch(() => null);
    if (!resolved) {
      return NextResponse.redirect(new URL("/market", request.url));
    }
    const click = await recordCampaignReferralClick({
      token: raw,
      destinationPath: resolved.destination,
      ip,
      requestUrl: request.url,
    }).catch(() => null);
    const destination = new URL(click?.destination ?? resolved.destination, request.url);
    const response = NextResponse.redirect(destination);
    if (click) {
      response.cookies.set({
        name: ATTRIBUTION_COOKIE,
        value: click.cookie,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: click.maxAge,
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  }

  const resolved = await resolvePublicReferral(raw).catch(() => null);
  const destination = resolved
    ? new URL(
        `/market/${resolved.productSlug}?ref=${encodeURIComponent(resolved.code)}`,
        request.url,
      )
    : new URL("/market", request.url);
  const response = NextResponse.redirect(destination);
  if (resolved) {
    await recordReferralClick(resolved.id).catch(() => undefined);
    response.cookies.set({
      name: REFERRAL_COOKIE,
      value: resolved.code,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
