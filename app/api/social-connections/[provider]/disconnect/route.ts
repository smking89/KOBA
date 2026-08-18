import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidSocialProvider } from "@/features/social-connections/lib/providers";
import {
  disconnectShopSocial,
  disconnectUserSocial,
  SocialConnectionError,
} from "@/features/social-connections/services/social-connection.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { provider: rawProvider } = await params;
  const provider = rawProvider.toUpperCase();
  if (!isValidSocialProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { shopId?: string };

  try {
    if (body.shopId) {
      await disconnectShopSocial(body.shopId, session.user.id, provider);
    } else {
      await disconnectUserSocial(session.user.id, provider);
    }
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    if (err instanceof SocialConnectionError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "FORBIDDEN" ? 403 : 404 });
    }
    return NextResponse.json({ error: "Could not disconnect." }, { status: 500 });
  }
}
