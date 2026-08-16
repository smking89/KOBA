import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  hashApiKeySecret,
  hashesEqual,
  parseApiKey,
  secretsEqual,
} from "@/features/developers/lib/api-keys";
import { isAllowedArtifact, sanitizeArtifactFilename } from "@/features/developers/lib/artifacts";
import { developerMalwareScanningActive } from "@/features/developers/lib/malware-scan";
import { developerCommissionBps, splitCoinPurchase } from "@/features/developers/lib/pricing";
import {
  canDestroyProfile,
  canManagePayouts,
  canManageSecrets,
  canManageProducts,
} from "@/features/developers/lib/roles";
import { assertScopes, hasScope } from "@/features/developers/lib/scopes";
import {
  assertDevProductTransition,
  canTransitionDevProduct,
  isPublicDevState,
} from "@/features/developers/lib/state-machine";
import {
  isReplayTimestamp,
  payloadHash,
  signWebhookPayload,
  verifyWebhookSignature,
} from "@/features/developers/lib/webhook-crypto";
import { assertSafeHostname, SsrfError } from "@/features/servers/lib/ssrf";
import {
  createDevProductSchema,
  createApiKeySchema,
} from "@/features/developers/schemas/developer.schemas";
import { DEVELOPER_SIGNED_URL_TTL_SECONDS } from "@/features/developers/lib/storage";
import { devReviewLabel } from "@/features/developer-portal/lib/types";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

describe("developer team roles", () => {
  it("restricts secrets, payouts, and destructive actions", () => {
    expect(canManageSecrets("OWNER")).toBe(true);
    expect(canManageSecrets("ADMIN")).toBe(true);
    expect(canManageSecrets("DEVELOPER")).toBe(false);
    expect(canManageSecrets("SUPPORT")).toBe(false);
    expect(canManagePayouts("OWNER")).toBe(true);
    expect(canManagePayouts("ADMIN")).toBe(false);
    expect(canDestroyProfile("DEVELOPER")).toBe(false);
    expect(canManageProducts("DEVELOPER")).toBe(true);
    expect(canManageProducts("ANALYST")).toBe(false);
  });
});

describe("API key format and hashing", () => {
  it("generates sandbox keys, hashes the full secret, and compares in constant time", () => {
    const generated = generateApiKey("SANDBOX");
    expect(generated.full.startsWith("koba_sandbox_")).toBe(true);
    expect(generated.full).toContain(generated.prefix);
    expect(generated.secretHash).toBe(hashApiKeySecret(generated.full));
    expect(hashesEqual(generated.secretHash, hashApiKeySecret(generated.full))).toBe(true);
    expect(
      hashesEqual(generated.secretHash, hashApiKeySecret("koba_sandbox_deadbeefdead_nope")),
    ).toBe(false);
    expect(parseApiKey(generated.full)?.prefix).toBe(generated.prefix);
    expect(parseApiKey("not-a-key")).toBeNull();
    expect(secretsEqual("abc", "abc")).toBe(true);
    expect(secretsEqual("abc", "abd")).toBe(false);
  });

  it("never puts the secret in the public prefix", () => {
    const generated = generateApiKey("PRODUCTION");
    expect(generated.prefix.startsWith("koba_live_")).toBe(true);
    expect(generated.prefix.includes(generated.secret)).toBe(false);
    expect(generated.full.split("_").length).toBeGreaterThan(3);
  });
});

describe("scopes", () => {
  it("enforces the explicit read-only registry", () => {
    expect(hasScope(["profile:read"], "profile:read")).toBe(true);
    expect(hasScope(["profile:read"], "orders:read")).toBe(false);
    expect(() => assertScopes(["profile:read"], ["profile:read"])).not.toThrow();
    expect(() => assertScopes(["orders:read"], ["profile:read"])).toThrow("INVALID_SCOPE");
    expect(() => assertScopes(["admin:write"], ["admin:write"])).toThrow("INVALID_SCOPE");
  });
});

describe("product state machine", () => {
  it("keeps drafts unpublished until staff publish", () => {
    expect(isPublicDevState("APPROVED")).toBe(false);
    expect(isPublicDevState("PUBLISHED")).toBe(true);
    expect(canTransitionDevProduct("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionDevProduct("DRAFT", "PUBLISHED")).toBe(false);
    expect(() => assertDevProductTransition("PUBLISHED", "DRAFT")).toThrow();
    expect(devReviewLabel("SECURITY_REVIEW")).toBe("Security review");
  });
});

describe("artifacts and malware hook", () => {
  it("allowlists extensions and sanitizes names", () => {
    expect(isAllowedArtifact("plugin.zip", "application/zip")).toBe(true);
    expect(isAllowedArtifact("plugin.exe", "application/octet-stream")).toBe(false);
    expect(sanitizeArtifactFilename("../../Evil DLL.dll")).toBe("evil-dll.dll");
    expect(developerMalwareScanningActive()).toBe(false);
    expect(DEVELOPER_SIGNED_URL_TTL_SECONDS).toBe(120);
  });
});

describe("pricing split", () => {
  it("uses integer coins and configurable commission", () => {
    const split = splitCoinPurchase(100n, 800);
    expect(split.feeCoins).toBe(8n);
    expect(split.sellerCoins).toBe(92n);
    expect(split.feeCoins + split.sellerCoins).toBe(100n);
    expect(Number.isInteger(developerCommissionBps(false))).toBe(true);
  });
});

describe("webhook signatures and replay", () => {
  it("signs HMAC over timestamp.body and rejects old timestamps", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ version: 1, type: "order.completed" });
    const timestamp = new Date().toISOString();
    const signature = signWebhookPayload(secret, timestamp, body);
    expect(verifyWebhookSignature(secret, timestamp, body, signature)).toBe(true);
    expect(verifyWebhookSignature(secret, timestamp, body, "00".repeat(32))).toBe(false);
    expect(isReplayTimestamp(new Date(Date.now() - 10 * 60 * 1000).toISOString())).toBe(true);
    expect(isReplayTimestamp(timestamp)).toBe(false);
    expect(payloadHash("order.completed", body)).toBe(
      createHash("sha256").update(`order.completed:${body}`).digest("hex"),
    );
    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(signature).toBe(expected);
  });
});

describe("webhook SSRF host rejection", () => {
  it("rejects loopback, private, and metadata hosts", () => {
    expect(() => assertSafeHostname("127.0.0.1")).toThrow(SsrfError);
    expect(() => assertSafeHostname("10.0.0.4")).toThrow(SsrfError);
    expect(() => assertSafeHostname("169.254.169.254")).toThrow(SsrfError);
    expect(() => assertSafeHostname("localhost")).toThrow(SsrfError);
  });
});

describe("validation schemas reject mass-assignment shaped junk", () => {
  it("strips unknown API key fields", () => {
    const parsed = createApiKeySchema.safeParse({
      applicationRef: "KOBA-DAPP-ABCDEF12",
      name: "ci",
      scopes: ["profile:read"],
      secretHash: "attacker",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires a name for products", () => {
    const parsed = createDevProductSchema.safeParse({ kind: "PLUGIN" });
    expect(parsed.success).toBe(false);
  });
});

describe("route protection and cache", () => {
  it("protects portal secrets and purchase history", () => {
    expect(isProtectedPath("/developers/api-keys")).toBe(true);
    expect(isProtectedPath("/developers/dashboard")).toBe(true);
    expect(isProtectedPath("/library/apps")).toBe(true);
    expect(isProtectedPath("/developers")).toBe(false);
    expect(isSensitivePath("/api/v1/profile")).toBe(true);
    expect(isSensitivePath("/api/apps/demo/purchase")).toBe(true);
  });
});
