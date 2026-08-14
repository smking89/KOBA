import { NextResponse } from "next/server";
import { registerSchema } from "@/features/auth/schemas/auth.schemas";
import { AuthServiceError, registerUser } from "@/features/auth/services/auth.service";
import { rateLimit } from "@/lib/security/rate-limit";

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);

  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await registerUser(parsed.data, ip);
    return NextResponse.json({ ok: true, userId: result.userId }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthServiceError && error.code === "EMAIL_EXISTS") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
