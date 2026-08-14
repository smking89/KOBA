import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonPlusError } from "@/features/plus/lib/http";
import { plusActionSchema } from "@/features/plus/schemas/plus.schemas";
import {
  cancelSubscription,
  getSubscription,
  startCheckoutHandoff,
} from "@/features/plus/services/plus.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json(await getSubscription(session.user.id));
  } catch (error) {
    return jsonPlusError(error, "Could not load Plus subscription.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`plus-action:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many Plus attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = plusActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Plus action." }, { status: 400 });
  }
  try {
    if (parsed.data.action === "checkout") {
      const opts: { planId?: string; interval?: "MONTHLY" | "ANNUAL" } = {};
      if (parsed.data.planId !== undefined) opts.planId = parsed.data.planId;
      if (parsed.data.interval !== undefined) opts.interval = parsed.data.interval;
      const result = await startCheckoutHandoff(session.user.id, opts, clientIp(request));
      return NextResponse.json(result);
    }
    const subscription = await cancelSubscription(session.user.id, clientIp(request));
    return NextResponse.json({ subscription });
  } catch (error) {
    return jsonPlusError(error, "Could not update Plus subscription.");
  }
}
