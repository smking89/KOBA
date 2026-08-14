import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { switchAccountSchema } from "@/features/accounts/schemas/account.schemas";
import { KobaIdError } from "@/features/koba-id/services/mint.service";
import { switchActiveAccount } from "@/features/accounts/services/account.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`account-switch:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many switch attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = switchAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
  }

  try {
    const snapshot = await switchActiveAccount(session.user.id, parsed.data.accountType, ip);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    if (error instanceof KobaIdError) {
      const status = error.code === "IDENTITY_MISSING" ? 409 : 403;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not switch account." }, { status: 500 });
  }
}
