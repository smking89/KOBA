import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeInternalPath, safeStaffCallbackPath } from "@/lib/security/safe-redirect";
import { assertSeedAllowed } from "@/lib/security/seed-guard";
import { resolveAuthSecret } from "@/lib/auth/secret";
import { edgeAuthConfig } from "@/lib/auth/edge.config";
import {
  isLoginThrottled,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
} from "@/features/auth/lib/login-throttle";
import { resetRateLimitStore } from "@/lib/security/rate-limit";
import {
  isSensitiveDocumentPath,
  LEGACY_PAGE_CACHES,
  PAGES_CACHE_NAME,
} from "@/lib/pwa/sensitive-routes";
import { artifactBytesMatchExtension } from "@/features/developers/lib/artifacts";

describe("KOBA-SEC-002 safe redirect", () => {
  it("allows plain internal paths", () => {
    expect(safeInternalPath("/wallet")).toBe("/wallet");
    expect(safeInternalPath("/orders/KOBA-123?tab=items")).toBe("/orders/KOBA-123?tab=items");
  });

  it("falls back for absolute and protocol-relative URLs", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBe("/enter");
    expect(safeInternalPath("//evil.example/phish")).toBe("/enter");
    expect(safeInternalPath("/\\evil.example")).toBe("/enter");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/enter");
  });

  it("falls back for backslashes, control characters and empty values", () => {
    expect(safeInternalPath("/a\\b")).toBe("/enter");
    expect(safeInternalPath("/a\nb")).toBe("/enter");
    expect(safeInternalPath("")).toBe("/enter");
    expect(safeInternalPath(null)).toBe("/enter");
    expect(safeInternalPath(undefined, "/")).toBe("/");
  });

  it("restricts post-MFA staff redirects to an internal allowlist", () => {
    expect(safeStaffCallbackPath("/admin/reports")).toBe("/admin/reports");
    expect(safeStaffCallbackPath("/settings/security/mfa")).toBe("/settings/security/mfa");
    expect(safeStaffCallbackPath("/enter")).toBe("/enter");
    expect(safeStaffCallbackPath("/wallet")).toBe("/admin");
    expect(safeStaffCallbackPath("https://evil.example")).toBe("/admin");
  });
});

describe("KOBA-SEC-001 seed guard", () => {
  it("refuses to seed in production", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production" })).toThrow(/Refusing to seed/);
  });

  it("allows seeding outside production", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: "test" })).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: undefined })).not.toThrow();
  });
});

describe("KOBA-SEC-010 auth secret resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured secret", () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    expect(resolveAuthSecret()).toBe("a".repeat(40));
  });

  it("throws in production runtime when the secret is missing", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveAuthSecret()).toThrow(/AUTH_SECRET is required/);
  });

  it("uses a placeholder only during the production build phase", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(resolveAuthSecret()).toContain("build-phase-placeholder");
  });
});

describe("KOBA-SEC-004 JWT claims cannot be set by the client", () => {
  it("ignores update() payloads in the shared edge callback", () => {
    const token = {
      sub: "user-1",
      kobaId: "KOBA-P-1111",
      accountType: "PLAYER",
      kobaIdRevealed: false,
    };
    const result = edgeAuthConfig.callbacks.jwt({
      token: { ...token },
      trigger: "update",
      session: { accountType: "SUPERADMIN", kobaId: "KOBA-S-9999", kobaIdRevealed: true },
      // Auth.js passes more fields; the callback must not need them.
    } as never);
    expect(result.accountType).toBe("PLAYER");
    expect(result.kobaId).toBe("KOBA-P-1111");
    expect(result.kobaIdRevealed).toBe(false);
  });

  it("still applies claims from the authenticated user at sign-in", () => {
    const result = edgeAuthConfig.callbacks.jwt({
      token: {},
      user: {
        id: "user-2",
        kobaId: "KOBA-B-2222",
        accountType: "BUSINESS",
        kobaIdRevealed: true,
      },
    } as never);
    expect(result.sub).toBe("user-2");
    expect(result.accountType).toBe("BUSINESS");
    expect(result.kobaIdRevealed).toBe(true);
  });
});

describe("KOBA-SEC-005 login throttling", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("throttles repeated attempts against one email", async () => {
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i += 1) {
      expect(await isLoginThrottled(`ip-${i}`, "victim@example.com")).toBe(false);
    }
    expect(await isLoginThrottled("ip-final", "victim@example.com")).toBe(true);
  });

  it("throttles a single IP spraying many emails", async () => {
    for (let i = 0; i < LOGIN_IP_LIMIT; i += 1) {
      expect(await isLoginThrottled("10.0.0.9", `user-${i}@example.com`)).toBe(false);
    }
    expect(await isLoginThrottled("10.0.0.9", "another@example.com")).toBe(true);
  });

  it("does not throttle unrelated users", async () => {
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i += 1) {
      await isLoginThrottled(`ip-${i}`, "victim@example.com");
    }
    expect(await isLoginThrottled("ip-clean", "innocent@example.com")).toBe(false);
  });
});

describe("KOBA-PWA-001/002 sensitive document caching", () => {
  it("marks authenticated documents as never-cache", () => {
    expect(isSensitiveDocumentPath("/wallet")).toBe(true);
    expect(isSensitiveDocumentPath("/admin")).toBe(true);
    expect(isSensitiveDocumentPath("/messages/KOBA-DM-1")).toBe(true);
    expect(isSensitiveDocumentPath("/orders")).toBe(true);
    expect(isSensitiveDocumentPath("/business/payouts")).toBe(true);
    expect(isSensitiveDocumentPath("/kobaid")).toBe(true);
  });

  it("keeps public pages cacheable and avoids prefix false-positives", () => {
    expect(isSensitiveDocumentPath("/")).toBe(false);
    expect(isSensitiveDocumentPath("/market")).toBe(false);
    expect(isSensitiveDocumentPath("/groups/rust-raiders")).toBe(false);
    expect(isSensitiveDocumentPath("/walletish-page")).toBe(false);
  });

  it("versions the page cache and tracks legacy caches for cleanup", () => {
    expect(PAGES_CACHE_NAME).not.toBe("koba-pages");
    expect(LEGACY_PAGE_CACHES).toContain("koba-pages");
  });
});

describe("KOBA-MED-001 artifact content validation", () => {
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
  const gzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
  const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
  const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02]);

  it("accepts archives whose bytes match the extension", () => {
    expect(artifactBytesMatchExtension(zip, "plugin.zip")).toBe(true);
    expect(artifactBytesMatchExtension(gzip, "plugin.tgz")).toBe(true);
    expect(artifactBytesMatchExtension(gzip, "plugin.tar.gz")).toBe(true);
    const tar = Buffer.alloc(512);
    tar.write("ustar", 257, "ascii");
    expect(artifactBytesMatchExtension(tar, "plugin.tar")).toBe(true);
  });

  it("accepts plain text artifacts without binary content", () => {
    expect(artifactBytesMatchExtension(Buffer.from('{"name":"x"}'), "manifest.json")).toBe(true);
    expect(artifactBytesMatchExtension(Buffer.from("# readme"), "readme.md")).toBe(true);
  });

  it("rejects extension/content mismatches", () => {
    expect(artifactBytesMatchExtension(exe, "plugin.zip")).toBe(false);
    expect(artifactBytesMatchExtension(Buffer.from("plain text"), "plugin.zip")).toBe(false);
    expect(artifactBytesMatchExtension(zip, "notes.txt")).toBe(false);
  });

  it("rejects native executables regardless of claimed name", () => {
    expect(artifactBytesMatchExtension(exe, "totally-a-readme.txt")).toBe(false);
    expect(artifactBytesMatchExtension(elf, "plugin.tar.gz")).toBe(false);
    expect(artifactBytesMatchExtension(Buffer.alloc(0), "plugin.zip")).toBe(false);
  });
});
