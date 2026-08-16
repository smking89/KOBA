import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/features/auth/schemas/auth.schemas";
import { resendVerificationEmail } from "@/features/auth/services/auth.service";
import { rateLimit } from "@/lib/security/rate-limit";

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`resend-verification:${ip}`, 5, 15 * 60 * 1000);

  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  await resendVerificationEmail(parsed.data.email);

  return NextResponse.json({
    ok: true,
    message: "If this account needs verification, a new link was sent.",
  });
}
