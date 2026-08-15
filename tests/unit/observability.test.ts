import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALERT_EVENTS,
  AppError,
  classifyError,
  composeReadiness,
  emitAlert,
  getLiveness,
  isSentryEnabled,
  isValidRequestId,
  isWorkerStale,
  logger,
  newRequestId,
  recordWorkerHeartbeat,
  redactHeaders,
  redactValue,
  resetAlertWindowsForTests,
  resetWorkerHeartbeatsForTests,
  resolveRequestId,
  runWithObservabilityContext,
  sentryBeforeSend,
  shouldDropError,
} from "@/lib/observability";
import { captureException, safeErrorJson } from "@/lib/observability/capture";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as readyGet } from "@/app/api/ready/route";
import { resolveCorrelationId } from "@/lib/observability/correlation";

describe("redaction", () => {
  it("redacts recursive secret keys including common variations", () => {
    const input = {
      user: "ok",
      password: "hunter2",
      passwordHash: "bcrypt",
      nested: {
        api_key: "k",
        apiKey: "k2",
        Authorization: "Bearer abc",
        cookie: "sid=1",
        totpCode: "123456",
        totp_secret: "base32",
        recoveryCodes: ["AAAA-BBBB"],
        stripeSecret: "sk_test_123",
        rconPassword: "rcon",
        signedUrl: "https://s3/x?X-Amz-Signature=1",
        prompt: "private aiden prompt",
        messages: "private dm",
        dm: "hello",
      },
    };
    const redacted = redactValue(input) as typeof input;
    expect(redacted.user).toBe("ok");
    expect(redacted.password).toBe("[Redacted]");
    expect(redacted.passwordHash).toBe("[Redacted]");
    expect(redacted.nested.api_key).toBe("[Redacted]");
    expect(redacted.nested.apiKey).toBe("[Redacted]");
    expect(redacted.nested.Authorization).toBe("[Redacted]");
    expect(redacted.nested.cookie).toBe("[Redacted]");
    expect(redacted.nested.totpCode).toBe("[Redacted]");
    expect(redacted.nested.totp_secret).toBe("[Redacted]");
    expect(redacted.nested.recoveryCodes).toBe("[Redacted]");
    expect(redacted.nested.stripeSecret).toBe("[Redacted]");
    expect(redacted.nested.rconPassword).toBe("[Redacted]");
    expect(redacted.nested.signedUrl).toBe("[Redacted]");
    expect(redacted.nested.prompt).toBe("[Redacted]");
    expect(redacted.nested.messages).toBe("[Redacted]");
    expect(redacted.nested.dm).toBe("[Redacted]");
  });

  it("redacts authorization and cookie headers", () => {
    const headers = redactHeaders({
      authorization: "Bearer secret-token",
      cookie: "session=abc",
      "x-request-id": "req_abc12345",
    });
    expect(headers.authorization).toBe("[Redacted]");
    expect(headers.cookie).toBe("[Redacted]");
    expect(headers["x-request-id"]).toBe("req_abc12345");
  });

  it("redacts stripe and jwt-shaped values even on safe keys", () => {
    const redacted = redactValue({
      note: "sk_live_abcdefghijklmnopqrstuvwxyz",
      sessionBlob: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
    }) as { note: string; sessionBlob: string };
    expect(redacted.note).toBe("[Redacted]");
    expect(redacted.sessionBlob).toBe("[Redacted]");
  });
});

describe("request ids", () => {
  it("generates bounded request ids", () => {
    const id = newRequestId();
    expect(id.startsWith("req_")).toBe(true);
    expect(isValidRequestId(id)).toBe(true);
  });

  it("rejects invalid upstream ids including header-injection payloads", () => {
    expect(isValidRequestId("short")).toBe(false);
    expect(isValidRequestId("abc\ninjected")).toBe(false);
    expect(isValidRequestId("id with spaces-xx")).toBe(false);
    expect(isValidRequestId("x".repeat(200))).toBe(false);
    const resolved = resolveRequestId("not valid\r\nX-Injected: 1");
    expect(resolved.startsWith("req_")).toBe(true);
    expect(resolved).not.toContain("\n");
  });

  it("accepts a trusted upstream id", () => {
    expect(resolveRequestId("req_deadbeef12")).toBe("req_deadbeef12");
  });
});

describe("correlation ids", () => {
  it("reuses the active context correlation id", () => {
    runWithObservabilityContext({ correlationId: "cor_abc123456789" }, () => {
      expect(resolveCorrelationId()).toBe("cor_abc123456789");
    });
  });

  it("mints a bounded correlation id outside a context", () => {
    const minted = resolveCorrelationId();
    expect(minted.startsWith("cor_")).toBe(true);
    expect(minted.length).toBeLessThanOrEqual(128);
  });
});

describe("structured logger", () => {
  const previous = process.env.KOBA_LOG_JSON;

  beforeEach(() => {
    process.env.KOBA_LOG_JSON = "true";
  });

  afterEach(() => {
    process.env.KOBA_LOG_JSON = previous;
  });

  it("emits JSON with timestamp, severity, service, and redacted extras", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    runWithObservabilityContext(
      { requestId: "req_logger0001", correlationId: "cor_logger0001" },
      () => {
        logger.info("hello", {
          event: "unit_test",
          operation: "log_format",
          outcome: "success",
          extra: { password: "secret", ok: true },
        });
      },
    );
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.ts).toMatch(/^\d{4}-/);
    expect(payload.severity).toBe("info");
    expect(payload.service).toBe("koba");
    expect(payload.requestId).toBe("req_logger0001");
    expect(payload.correlationId).toBe("cor_logger0001");
    expect(payload.event).toBe("unit_test");
    expect(payload.extra.password).toBe("[Redacted]");
    expect(payload.extra.ok).toBe(true);
    spy.mockRestore();
  });
});

describe("error capture", () => {
  it("returns a generic production payload with an error id", () => {
    const json = safeErrorJson("koba_err_abc", "db exploded", true);
    expect(json).toEqual({ error: "Something went wrong.", errorId: "koba_err_abc" });
  });

  it("captures unexpected errors once", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    runWithObservabilityContext({ requestId: "req_cap0000001" }, () => {
      const first = captureException(new Error("boom"));
      const second = captureException(new Error("boom-again"));
      expect(first).toBe(second);
      expect(first.startsWith("koba_err_")).toBe(true);
    });
    expect(spy.mock.calls.length).toBe(1);
    spy.mockRestore();
  });

  it("does not treat expected validation errors as unexpected", () => {
    expect(shouldDropError(new AppError("bad", "validation"))).toBe(true);
    expect(classifyError(new AppError("nope", "authentication"))).toBe("authentication");
  });
});

describe("sentry disabled mode", () => {
  it("never enables Sentry in the test environment even with a DSN", () => {
    const previous = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/1";
    expect(isSentryEnabled()).toBe(false);
    process.env.SENTRY_DSN = previous;
  });

  it("redacts request bodies and cookies in beforeSend", () => {
    const event = sentryBeforeSend({
      extra: { authorization: "Bearer x", user: "ok" },
      request: {
        headers: { authorization: "Bearer x", "x-request-id": "req_aaaaaaaa" },
        cookies: "session=abc",
        data: { password: "secret", totp: "123456" },
      },
    });
    expect(event).not.toBeNull();
    const extra = event?.extra as { authorization: string; user: string };
    expect(extra.authorization).toBe("[Redacted]");
    expect(extra.user).toBe("ok");
    const request = event?.request as {
      cookies: string;
      data?: unknown;
      headers: Record<string, string>;
    };
    expect(request.cookies).toBe("[Redacted]");
    expect(request.data).toBeUndefined();
    expect(request.headers.authorization).toBe("[Redacted]");
  });

  it("drops expected auth/validation errors before send", () => {
    expect(
      sentryBeforeSend({ extra: {} }, { originalException: new AppError("no", "authentication") }),
    ).toBeNull();
  });
});

describe("health and readiness", () => {
  it("returns liveness without hostnames or secrets", () => {
    const body = getLiveness("skipped");
    expect(body.ok).toBe(true);
    expect(body.service).toBe("koba");
    expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\//);
    expect(JSON.stringify(body)).not.toMatch(/localhost/);
  });

  it("sets no-store on the health response", async () => {
    const response = await healthGet(new Request("http://127.0.0.1/api/health"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.status).toBe(200);
  });

  it("sets no-store on the readiness response", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await readyGet();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect([200, 503]).toContain(response.status);
    const body = (await response.json()) as { service?: string; checks?: Record<string, unknown> };
    expect(body.service).toBe("koba");
    expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\//);
    expect(JSON.stringify(body)).not.toMatch(/AUTH_SECRET/);
    spy.mockRestore();
  });

  it("reports readiness success, dependency failure, and optional degradation", () => {
    const ok = composeReadiness({
      database: "ok",
      redis: "unset",
      requiredConfig: true,
      optional: {
        sentry: "unset",
        email: "unset",
        objectStorage: "unset",
        aidenProvider: "inactive",
        rconEncryption: "unset",
        credentialEncryption: "unset",
        stripe: "unset",
      },
    });
    expect(ok.ready).toBe(true);
    expect(ok.degraded).toBe(true);

    const failed = composeReadiness({
      database: "error",
      redis: "ok",
      requiredConfig: true,
      optional: {
        sentry: "configured",
        email: "configured",
        objectStorage: "configured",
        aidenProvider: "configured",
        rconEncryption: "configured",
        credentialEncryption: "configured",
        stripe: "test",
      },
    });
    expect(failed.ready).toBe(false);
    expect(failed.ok).toBe(false);
  });
});

describe("worker heartbeats and alerts", () => {
  beforeEach(() => {
    resetWorkerHeartbeatsForTests();
    resetAlertWindowsForTests();
  });

  it("records heartbeats and detects stale workers", () => {
    recordWorkerHeartbeat({ worker: "aiden", loop: true, at: 1_000 });
    expect(isWorkerStale("aiden", 5_000, 2_000)).toBe(false);
    expect(isWorkerStale("aiden", 5_000, 10_000)).toBe(true);
    expect(isWorkerStale("missing", 5_000, 1_000)).toBe(true);
  });

  it("emits a critical job-failure event without user ids as labels", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.KOBA_LOG_JSON = "true";
    await emitAlert("job_terminal_failure", "Worker batch failed", {
      labels: {
        worker: "aiden",
        operation: "aiden",
        userId: "user_should_not_appear",
        errorClass: "worker",
      },
    });
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.event).toBe("job_terminal_failure");
    expect(JSON.stringify(payload)).not.toContain("user_should_not_appear");
    expect(ALERT_EVENTS).toContain("backup_failure_placeholder");
    spy.mockRestore();
  });
});
