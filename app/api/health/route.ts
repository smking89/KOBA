import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email/mailer";
import { isUpstashConfigured } from "@/lib/security/rate-limit";
import { isObjectStorageConfigured } from "@/features/media/lib/storage";
import { getStripeReadiness } from "@/features/payments/lib/stripe-readiness";
import { isCredentialEncryptionConfigured } from "@/lib/crypto/credential-box";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  let database: "ok" | "error" | "skipped" = "skipped";
  if (deep) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const stripe = getStripeReadiness();
  const body = {
    ok: database !== "error",
    service: "koba",
    time: new Date().toISOString(),
    checks: {
      database,
      email: isEmailConfigured() ? "configured" : "dev-or-unset",
      rateLimit: isUpstashConfigured() ? "upstash" : "memory",
      objectStorage: isObjectStorageConfigured() ? "configured" : "unset",
      stripe: stripe.mode,
      credentialEncryption: isCredentialEncryptionConfigured() ? "configured" : "missing",
    },
  };

  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
