import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { pollDeviceToken } from "@/features/oauth-device/services/device-flow.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceCode: z.string().min(1).max(200),
  clientKey: z.string().min(1).max(64),
});

const STATUS_BY_ERROR: Record<string, number> = {
  authorization_pending: 428,
  slow_down: 429,
  access_denied: 403,
  expired_token: 410,
  invalid_grant: 400,
};

/** Step 3 of the device flow — the plugin polls this every `interval`
 * seconds until it gets a token or a terminal error (RFC 8628 §3.5). */
export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`oauth-device-token:${ip}`, 120, 10 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "slow_down" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await pollDeviceToken(parsed.data.deviceCode, parsed.data.clientKey);
  if (result.ok) {
    return NextResponse.json({
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      scope: result.scope,
    });
  }
  return NextResponse.json({ error: result.error }, { status: STATUS_BY_ERROR[result.error] ?? 400 });
}
