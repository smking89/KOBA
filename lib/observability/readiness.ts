import { prisma } from "@/lib/db";
import { aidenProviderId } from "@/features/aiden/lib/pricing";
import { isObjectStorageConfigured } from "@/features/media/lib/storage";
import { getStripeReadiness } from "@/features/payments/lib/stripe-readiness";
import { isCredentialEncryptionConfigured } from "@/lib/crypto/credential-box";
import { isEmailConfigured } from "@/lib/email/mailer";
import { isSentryEnabled, observabilityRelease, serviceName } from "@/lib/observability/config";
import { isUpstashConfigured } from "@/lib/security/rate-limit";

export type CheckState =
  "ok" | "error" | "skipped" | "degraded" | "inactive" | "unset" | "configured";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function pingDatabase(ms = 1500): Promise<"ok" | "error"> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, ms);
    return "ok";
  } catch {
    return "error";
  }
}

export async function pingRedis(ms = 1500): Promise<CheckState> {
  if (!isUpstashConfigured()) return "unset";
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return "unset";
  try {
    const response = await withTimeout(
      fetch(`${url.replace(/\/$/, "")}/ping`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }),
      ms,
    );
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export function optionalServiceStates() {
  const stripe = getStripeReadiness();
  return {
    sentry: isSentryEnabled() ? "configured" : "unset",
    email: isEmailConfigured() ? "configured" : "unset",
    objectStorage: isObjectStorageConfigured() ? "configured" : "unset",
    aidenProvider: aidenProviderId() === "mock" ? "inactive" : "configured",
    rconEncryption: isCredentialEncryptionConfigured() ? "configured" : "unset",
    credentialEncryption: isCredentialEncryptionConfigured() ? "configured" : "unset",
    stripe: stripe.mode,
  } as const;
}

export function composeReadiness(input: {
  database: CheckState;
  redis: CheckState;
  requiredConfig: boolean;
  optional: ReturnType<typeof optionalServiceStates>;
}) {
  const ready = input.database === "ok" && input.redis !== "error" && input.requiredConfig;
  const degraded =
    input.optional.sentry === "unset" ||
    input.optional.email === "unset" ||
    input.optional.objectStorage === "unset" ||
    input.optional.aidenProvider === "inactive";

  return {
    ok: ready,
    ready,
    degraded: ready && degraded,
    service: serviceName(),
    release: observabilityRelease() ?? null,
    time: new Date().toISOString(),
    checks: {
      database: input.database,
      redis: input.redis,
      queue: "postgres",
      requiredConfig: input.requiredConfig ? "ok" : "error",
      ...input.optional,
    },
  };
}

export async function getReadiness() {
  const production = process.env.NODE_ENV === "production";
  const database = await pingDatabase();
  const redis = await pingRedis();
  const requiredConfig =
    Boolean(process.env.DATABASE_URL?.trim()) &&
    (production ? Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) : true);

  return composeReadiness({
    database,
    redis,
    requiredConfig,
    optional: optionalServiceStates(),
  });
}

export function getLiveness(database: "ok" | "error" | "skipped" = "skipped") {
  return {
    ok: database !== "error",
    service: serviceName(),
    time: new Date().toISOString(),
    checks: {
      database,
      ...optionalServiceStates(),
      rateLimit: isUpstashConfigured() ? "upstash" : "memory",
    },
  };
}
