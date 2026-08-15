import { createHash } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { DeveloperError } from "@/features/developers/lib/errors";
import { requireRole } from "@/features/developers/lib/identity";
import { generateDevWebhookRef, generateDeliveryId } from "@/features/developers/lib/refs";
import { assertSafeProviderUrl } from "@/features/aiden/lib/safe-fetch";
import {
  generateWebhookSecret,
  openWebhookSecret,
  payloadHash,
  sealWebhookSecret,
  signWebhookPayload,
} from "@/features/developers/lib/webhook-crypto";
import {
  DEV_WEBHOOK_PAYLOAD_VERSION,
  isDevWebhookEvent,
} from "@/features/developers/lib/webhook-events";
import type { CreateWebhookInput } from "@/features/developers/schemas/developer.schemas";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";
import { SsrfError } from "@/features/servers/lib/ssrf";
import { resolveCorrelationId } from "@/lib/observability/correlation";
import { runWithObservabilityContext } from "@/lib/observability/context";

export async function createWebhookEndpoint(userId: string, input: CreateWebhookInput) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) throw new DeveloperError("Create a developer profile first.", "INVALID");
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN"]);
  try {
    await assertSafeProviderUrl(input.url);
  } catch (error) {
    if (error instanceof SsrfError) {
      throw new DeveloperError("Webhook URL is not allowed.", "INVALID");
    }
    throw error;
  }
  if (process.env.NODE_ENV === "production" && !input.url.startsWith("https://")) {
    throw new DeveloperError("Production webhooks must use HTTPS.", "INVALID");
  }
  const events = input.events.filter(isDevWebhookEvent);
  const publicRef = generateDevWebhookRef();
  const generated = generateWebhookSecret();
  const placeholderId = `pending-${publicRef}`;
  const sealed = sealWebhookSecret(generated.secret, placeholderId);
  const endpoint = await prisma.developerWebhookEndpoint.create({
    data: {
      publicRef,
      profileId: mine.profileId,
      url: input.url,
      events,
      secretCiphertext: sealed.ciphertext,
      secretIv: sealed.iv,
      secretAuthTag: sealed.authTag,
      secretKeyVersion: sealed.keyVersion,
      secretPrefix: generated.prefix,
    },
  });
  const resealed = sealWebhookSecret(generated.secret, endpoint.id);
  await prisma.developerWebhookEndpoint.update({
    where: { id: endpoint.id },
    data: {
      secretCiphertext: resealed.ciphertext,
      secretIv: resealed.iv,
      secretAuthTag: resealed.authTag,
      secretKeyVersion: resealed.keyVersion,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_WEBHOOK_CREATED,
    targetType: "DeveloperWebhookEndpoint",
    targetId: endpoint.id,
    metadata: { publicRef, prefix: generated.prefix },
  });
  return {
    publicRef: endpoint.publicRef,
    url: endpoint.url,
    events: endpoint.events,
    secret: generated.secret,
    secretPrefix: generated.prefix,
    revealedOnce: true as const,
  };
}

export async function listWebhookEndpoints(userId: string) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) return [];
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN", "SUPPORT"]);
  const rows = await prisma.developerWebhookEndpoint.findMany({
    where: { profileId: mine.profileId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    publicRef: row.publicRef,
    url: row.url,
    events: row.events,
    secretPrefix: row.secretPrefix,
    disabled: Boolean(row.disabledAt),
    secret: null,
  }));
}

export async function enqueueWebhookEvent(input: {
  eventType: string;
  data: Record<string, unknown>;
}) {
  if (!isDevWebhookEvent(input.eventType)) return { queued: 0 };
  const body = JSON.stringify({
    version: DEV_WEBHOOK_PAYLOAD_VERSION,
    type: input.eventType,
    data: input.data,
  });
  const hash = payloadHash(input.eventType, body);
  const endpoints = await prisma.developerWebhookEndpoint.findMany({
    where: { disabledAt: null, events: { has: input.eventType } },
  });
  let queued = 0;
  for (const endpoint of endpoints) {
    const existing = await prisma.developerWebhookDelivery.findFirst({
      where: { endpointId: endpoint.id, payloadHash: hash, eventType: input.eventType },
    });
    if (existing) continue;
    await prisma.developerWebhookDelivery.create({
      data: {
        deliveryId: generateDeliveryId(),
        endpointId: endpoint.id,
        eventType: input.eventType,
        payloadJson: body,
        payloadHash: hash,
        timestamp: new Date(),
      },
    });
    queued += 1;
  }
  return { queued };
}

export async function claimWebhookDeliveries(limit = 8) {
  const now = new Date();
  const stale = new Date(now.getTime() - 2 * 60 * 1000);
  const candidates = await prisma.developerWebhookDelivery.findMany({
    where: {
      OR: [
        { status: "PENDING", runAfter: { lte: now } },
        { status: "PENDING", claimedAt: { lte: stale } },
      ],
    },
    orderBy: { runAfter: "asc" },
    take: limit,
  });
  const claimed: string[] = [];
  for (const row of candidates) {
    const updated = await prisma.developerWebhookDelivery.updateMany({
      where: { id: row.id, version: row.version, status: "PENDING" },
      data: { claimedAt: now, attempts: { increment: 1 }, version: { increment: 1 } },
    });
    if (updated.count === 1) claimed.push(row.deliveryId);
  }
  return claimed;
}

export async function processWebhookDelivery(deliveryId: string) {
  const row = await prisma.developerWebhookDelivery.findUnique({
    where: { deliveryId },
    include: { endpoint: true },
  });
  if (!row || row.status === "DELIVERED" || row.status === "CANCELLED") {
    return { deliveryId, skipped: true as const };
  }
  try {
    await assertSafeProviderUrl(row.endpoint.url);
    const secret = openWebhookSecret(
      {
        ciphertext: row.endpoint.secretCiphertext,
        iv: row.endpoint.secretIv,
        authTag: row.endpoint.secretAuthTag,
        keyVersion: row.endpoint.secretKeyVersion,
      },
      row.endpoint.id,
    );
    const timestamp = row.timestamp.toISOString();
    const signature = signWebhookPayload(secret, timestamp, row.payloadJson);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(row.endpoint.url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-KOBA-Timestamp": timestamp,
        "X-KOBA-Signature": signature,
        "X-KOBA-Delivery": row.deliveryId,
        "X-KOBA-Event": row.eventType,
        "X-KOBA-Correlation-Id": resolveCorrelationId(),
      },
      body: row.payloadJson,
    });
    clearTimeout(timer);
    const text = await response.text();
    if (text.length > 4096) {
      throw new Error("Webhook response too large.");
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await prisma.developerWebhookDelivery.update({
      where: { id: row.id },
      data: { status: "DELIVERED", lastError: null, claimedAt: null },
    });
    return { deliveryId, status: "DELIVERED" as const };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 180) : "delivery failed";
    if (row.attempts >= row.maxAttempts) {
      await prisma.developerWebhookDelivery.update({
        where: { id: row.id },
        data: { status: "FAILED", lastError: reason, claimedAt: null },
      });
      return { deliveryId, status: "FAILED" as const };
    }
    const backoff = Math.min(60_000, 2 ** row.attempts * 1000);
    await prisma.developerWebhookDelivery.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        runAfter: new Date(Date.now() + backoff),
        lastError: reason,
        claimedAt: null,
      },
    });
    return { deliveryId, status: "PENDING" as const, retry: true as const };
  }
}

export async function redeliverWebhook(userId: string, deliveryId: string) {
  const row = await prisma.developerWebhookDelivery.findUnique({
    where: { deliveryId },
    include: { endpoint: true },
  });
  if (!row) throw new DeveloperError("Delivery not found.", "NOT_FOUND");
  await requireRole(userId, row.endpoint.profileId, ["OWNER", "ADMIN"]);
  const copyHash = createHash("sha256")
    .update(`${row.payloadHash}:redeliver:${Date.now()}`)
    .digest("hex");
  const created = await prisma.developerWebhookDelivery.create({
    data: {
      deliveryId: generateDeliveryId(),
      endpointId: row.endpointId,
      eventType: row.eventType,
      payloadJson: row.payloadJson,
      payloadHash: copyHash,
      timestamp: new Date(),
    },
  });
  return { deliveryId: created.deliveryId };
}

export async function disableWebhookEndpoint(userId: string, publicRef: string) {
  const row = await prisma.developerWebhookEndpoint.findUnique({ where: { publicRef } });
  if (!row) throw new DeveloperError("Webhook endpoint not found.", "NOT_FOUND");
  await requireRole(userId, row.profileId, ["OWNER", "ADMIN"]);
  await prisma.developerWebhookEndpoint.update({
    where: { id: row.id },
    data: { disabledAt: new Date() },
  });
  return { publicRef, disabled: true as const };
}

export async function rotateWebhookSecret(userId: string, publicRef: string) {
  const row = await prisma.developerWebhookEndpoint.findUnique({ where: { publicRef } });
  if (!row) throw new DeveloperError("Webhook endpoint not found.", "NOT_FOUND");
  await requireRole(userId, row.profileId, ["OWNER", "ADMIN"]);
  const generated = generateWebhookSecret();
  const sealed = sealWebhookSecret(generated.secret, row.id);
  await prisma.developerWebhookEndpoint.update({
    where: { id: row.id },
    data: {
      secretCiphertext: sealed.ciphertext,
      secretIv: sealed.iv,
      secretAuthTag: sealed.authTag,
      secretKeyVersion: sealed.keyVersion,
      secretPrefix: generated.prefix,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_WEBHOOK_ROTATED,
    targetType: "DeveloperWebhookEndpoint",
    targetId: row.id,
    metadata: { publicRef, prefix: generated.prefix },
  });
  return {
    publicRef,
    secret: generated.secret,
    secretPrefix: generated.prefix,
    revealedOnce: true as const,
  };
}

export async function listWebhookDeliveries(userId: string, endpointRef?: string) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) return [];
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN", "SUPPORT"]);
  const rows = await prisma.developerWebhookDelivery.findMany({
    where: {
      endpoint: { profileId: mine.profileId, ...(endpointRef ? { publicRef: endpointRef } : {}) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      deliveryId: true,
      eventType: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function runWebhookBatch(limit = 8) {
  const claimed = await claimWebhookDeliveries(limit);
  const results = [];
  for (const deliveryId of claimed) {
    results.push(
      await runWithObservabilityContext(
        { jobId: deliveryId, correlationId: resolveCorrelationId() },
        () => processWebhookDelivery(deliveryId),
      ),
    );
  }
  return { claimed: claimed.length, results };
}

export { payloadHash };
