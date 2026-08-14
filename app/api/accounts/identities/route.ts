import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { addAccountTypeSchema } from "@/features/accounts/schemas/account.schemas";
import { KobaIdError } from "@/features/koba-id/services/mint.service";
import {
  addPublicAccountType,
  getAccountSnapshot,
} from "@/features/accounts/services/account.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`kobaid-mint:${session.user.id}`, 5, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many KOBAID creation attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = addAccountTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
  }

  try {
    await addPublicAccountType(session.user.id, parsed.data.accountType, ip);
    const snapshot = await getAccountSnapshot(session.user.id);
    return NextResponse.json({ ok: true, snapshot }, { status: 201 });
  } catch (error) {
    if (error instanceof KobaIdError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not mint KOBAID." }, { status: 500 });
  }
}
