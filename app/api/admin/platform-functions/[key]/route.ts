import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { isKnownPlatformFunctionKey } from "@/features/platform-control/lib/functions";
import {
  PlatformControlError,
  setPlatformFunctionEnabled,
} from "@/features/platform-control/services/platform-function.service";

const toggleSchema = z.object({
  enabled: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

function platformControlErrorStatus(code: PlatformControlError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    default:
      return 400;
  }
}

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`platform-fn-toggle:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many toggle attempts." }, { status: 429 });
  }

  const { key } = await context.params;
  if (!isKnownPlatformFunctionKey(key)) {
    return NextResponse.json({ error: "Unknown platform function." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid toggle request." }, { status: 400 });
  }

  try {
    const state = await setPlatformFunctionEnabled(
      session.user.id,
      key,
      parsed.data.enabled,
      parsed.data.note ?? null,
      clientIp(request),
    );
    return NextResponse.json({ function: state });
  } catch (error) {
    if (error instanceof PlatformControlError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: platformControlErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update platform function." }, { status: 500 });
  }
}
