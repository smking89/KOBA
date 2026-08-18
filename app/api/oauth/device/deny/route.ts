import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { denyDeviceGrant, DeviceFlowError } from "@/features/oauth-device/services/device-flow.service";

export const dynamic = "force-dynamic";

const schema = z.object({ userCode: z.string().min(1).max(16) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid code." }, { status: 400 });

  try {
    await denyDeviceGrant(parsed.data.userCode, session.user.id);
    return NextResponse.json({ denied: true });
  } catch (error) {
    if (error instanceof DeviceFlowError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not deny." }, { status: 500 });
  }
}
