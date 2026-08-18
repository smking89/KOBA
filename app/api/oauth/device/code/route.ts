import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { createDeviceGrant, DeviceFlowError } from "@/features/oauth-device/services/device-flow.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  clientKey: z.string().min(1).max(64),
  scopes: z.array(z.string().min(1).max(64)).max(10).default([]),
});

/** Step 1 of the device flow — the plugin calls this on launch/login
 * click to get a userCode to show + a deviceCode to poll with. */
export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`oauth-device-code:${ip}`, 20, 10 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
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

  try {
    const grant = await createDeviceGrant(parsed.data.clientKey, parsed.data.scopes);
    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    if (error instanceof DeviceFlowError) {
      const status = error.code === "INVALID_CLIENT" || error.code === "INVALID_SCOPE" ? 400 : 500;
      return NextResponse.json({ error: error.code.toLowerCase() }, { status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
