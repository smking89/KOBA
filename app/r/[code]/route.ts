import { NextResponse } from "next/server";
import {
  recordReferralClick,
  resolvePublicReferral,
} from "@/features/influencer/services/influencer.service";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS } from "@/features/influencer/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const resolved = await resolvePublicReferral(decodeURIComponent(code)).catch(() => null);
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
