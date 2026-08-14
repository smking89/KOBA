import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/features/auth/schemas/auth.schemas";
import { AuthServiceError, resetPassword } from "@/features/auth/services/auth.service";
import { rateLimit } from "@/lib/security/rate-limit";

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000);

  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await resetPassword(parsed.data.email, parsed.data.token, parsed.data.password, ip);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Password reset failed." }, { status: 500 });
  }
}
