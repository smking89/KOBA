import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import type { ZodType } from "zod";

export const integrationNoStore = { "Cache-Control": "no-store" };

export async function requireIntegrationSession() {
  const session = await auth();
  if (!session?.user.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401, headers: integrationNoStore },
      ),
    };
  }
  return { ok: true as const, session };
}

export async function limitIntegration(userId: string, action: string, max = 20) {
  const limited = await rateLimit(`server-rust-${action}:${userId}`, max, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many integration attempts.", code: "RATE_LIMITED" },
      { status: 429, headers: integrationNoStore },
    );
  }
  return null;
}

export async function readJson<T>(request: Request, schema: ZodType<T>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400, headers: integrationNoStore },
      ),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid integration request." },
        { status: 400, headers: integrationNoStore },
      ),
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function integrationOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: integrationNoStore });
}

export function integrationFail(error: unknown, fallback: string) {
  return jsonServerError(error, fallback);
}

export function requestIp(request: Request) {
  return clientIp(request);
}

export function actorFromSession(session: { user: { impersonatorId?: string | null } }) {
  return { impersonatorId: session.user.impersonatorId ?? null };
}
