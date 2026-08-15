import { describe, expect, it } from "vitest";
import {
  assertAllowedPort,
  assertSafeHostname,
  assertSafeIpLiteral,
  resolveSafeTarget,
  SsrfError,
} from "@/features/servers/lib/ssrf";

describe("ssrf protections", () => {
  it("rejects loopback and private IPv4", () => {
    expect(() => assertSafeIpLiteral("127.0.0.1")).toThrow(SsrfError);
    expect(() => assertSafeIpLiteral("10.0.0.5")).toThrow(SsrfError);
    expect(() => assertSafeIpLiteral("192.168.1.10")).toThrow(SsrfError);
    expect(() => assertSafeIpLiteral("172.16.0.1")).toThrow(SsrfError);
  });

  it("rejects link-local and metadata", () => {
    expect(() => assertSafeIpLiteral("169.254.1.1")).toThrow(SsrfError);
    expect(() => assertSafeIpLiteral("169.254.169.254")).toThrow(SsrfError);
  });

  it("rejects private / link-local IPv6", () => {
    expect(() => assertSafeIpLiteral("::1")).toThrow(SsrfError);
    expect(() => assertSafeIpLiteral("fe80::1")).toThrow(SsrfError);
    expect(() => assertSafeIpLiteral("fd12:3456:789a::1")).toThrow(SsrfError);
  });

  it("rejects localhost hostnames and URL fetching", () => {
    expect(() => assertSafeHostname("localhost")).toThrow(SsrfError);
    expect(() => assertSafeHostname("http://evil.example")).toThrow(SsrfError);
    expect(() => assertSafeHostname("metadata.google.internal")).toThrow(SsrfError);
  });

  it("rejects blocked and out-of-range ports", () => {
    expect(() => assertAllowedPort(22)).toThrow(SsrfError);
    expect(() => assertAllowedPort(5432)).toThrow(SsrfError);
    expect(() => assertAllowedPort(70000)).toThrow(SsrfError);
    expect(() => assertAllowedPort(25565, [25565])).not.toThrow();
    expect(() => assertAllowedPort(1, [25565])).toThrow(SsrfError);
  });

  it("defends against DNS rebinding to private IPs", async () => {
    await expect(
      resolveSafeTarget("evil.example", 25565, {
        allowedPorts: [25565],
        lookupFn: (async () => [{ address: "10.0.0.1", family: 4 }]) as never,
      }),
    ).rejects.toMatchObject({ reason: "DNS_REBINDING" });
  });

  it("accepts public IP literals", () => {
    expect(() => assertSafeIpLiteral("203.0.113.10")).not.toThrow();
  });
});
