import { afterEach, describe, expect, it } from "vitest";
import { buildPasswordResetUrl, buildVerificationUrl, isEmailConfigured } from "@/lib/email/mailer";
import {
  isAllowedMediaUrl,
  isHttpsUrl,
  isObjectStorageConfigured,
  mediaAllowedHosts,
} from "@/features/media/lib/storage";
import { getStripeReadiness } from "@/features/payments/lib/stripe-readiness";
import { isUpstashConfigured } from "@/lib/security/rate-limit";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

describe("email mailer helpers", () => {
  it("builds verification and reset links from public app URL", () => {
    expect(buildVerificationUrl("a@b.co", "tok")).toContain("/verify-email?token=tok");
    expect(buildVerificationUrl("a@b.co", "tok")).toContain("email=a%40b.co");
    expect(buildPasswordResetUrl("a@b.co", "tok")).toContain("/reset-password?token=tok");
  });

  it("reports email configuration from env", () => {
    const previousKey = process.env.RESEND_API_KEY;
    const previousFrom = process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "KOBA <noreply@example.com>";
    expect(isEmailConfigured()).toBe(true);
    process.env.RESEND_API_KEY = previousKey;
    process.env.EMAIL_FROM = previousFrom;
  });
});

describe("media allowlist", () => {
  const previousHosts = process.env.MEDIA_ALLOWED_HOSTS;
  const previousBase = process.env.S3_PUBLIC_BASE_URL;

  afterEach(() => {
    process.env.MEDIA_ALLOWED_HOSTS = previousHosts;
    process.env.S3_PUBLIC_BASE_URL = previousBase;
  });

  it("accepts any https URL when no allowlist is set", () => {
    delete process.env.MEDIA_ALLOWED_HOSTS;
    delete process.env.S3_PUBLIC_BASE_URL;
    expect(mediaAllowedHosts()).toEqual([]);
    expect(isHttpsUrl("https://cdn.koba.example/shot.png")).toBe(true);
    expect(isAllowedMediaUrl("https://cdn.koba.example/shot.png")).toBe(true);
    expect(isAllowedMediaUrl("http://cdn.koba.example/shot.png")).toBe(false);
  });

  it("restricts hosts when allowlist is configured", () => {
    process.env.MEDIA_ALLOWED_HOSTS = "cdn.koba.example, img.example.com";
    delete process.env.S3_PUBLIC_BASE_URL;
    expect(isAllowedMediaUrl("https://cdn.koba.example/a.png")).toBe(true);
    expect(isAllowedMediaUrl("https://evil.example/a.png")).toBe(false);
  });

  it("detects object storage placeholders as unset", () => {
    const prev = {
      bucket: process.env.S3_BUCKET,
      key: process.env.S3_ACCESS_KEY_ID,
      secret: process.env.S3_SECRET_ACCESS_KEY,
      base: process.env.S3_PUBLIC_BASE_URL,
    };
    process.env.S3_BUCKET = "koba-media";
    process.env.S3_ACCESS_KEY_ID = "replace_me";
    process.env.S3_SECRET_ACCESS_KEY = "replace_me";
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com";
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.S3_BUCKET = prev.bucket;
    process.env.S3_ACCESS_KEY_ID = prev.key;
    process.env.S3_SECRET_ACCESS_KEY = prev.secret;
    process.env.S3_PUBLIC_BASE_URL = prev.base;
  });
});

describe("stripe readiness", () => {
  it("keeps live keys blocked and reports test mode", () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    const previousAllow = process.env.STRIPE_ALLOW_LIVE;
    process.env.STRIPE_SECRET_KEY = "sk_live_real_looking_but_blocked";
    process.env.STRIPE_ALLOW_LIVE = "false";
    expect(getStripeReadiness().mode).toBe("live-blocked");
    expect(getStripeReadiness().configured).toBe(false);

    process.env.STRIPE_SECRET_KEY = "sk_test_valid_looking_key";
    expect(getStripeReadiness().mode).toBe("test");
    expect(getStripeReadiness().configured).toBe(true);

    process.env.STRIPE_SECRET_KEY = previous;
    process.env.STRIPE_ALLOW_LIVE = previousAllow;
  });
});

describe("prod readiness routes", () => {
  it("does not treat health as sensitive but caches media APIs carefully", () => {
    expect(isSensitivePath("/api/health")).toBe(false);
    expect(isSensitivePath("/api/ready")).toBe(false);
    expect(isSensitivePath("/api/media/presign")).toBe(true);
    expect(isUpstashConfigured()).toBe(
      Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    );
  });
});
