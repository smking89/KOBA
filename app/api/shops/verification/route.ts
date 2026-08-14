import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { requestShopVerification } from "@/features/shops/services/shop.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`shop-verify-request:${session.user.id}`, 5, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many verification requests." }, { status: 429 });
  }

  try {
    const shop = await requestShopVerification(session.user.id, ip);
    return NextResponse.json({ status: shop.verificationStatus });
  } catch (error) {
    return jsonShopError(error, "Could not request verification.");
  }
}
