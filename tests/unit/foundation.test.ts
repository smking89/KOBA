import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { kobaTokens } from "@/lib/design-tokens";
import { getPublicEnv } from "@/lib/env";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
});

describe("kobaTokens", () => {
  it("exposes the neon dark brand palette", () => {
    expect(kobaTokens.background).toBe("#050505");
    expect(kobaTokens.neonLime).toBe("#B8FF00");
    expect(kobaTokens.brandGradient).toContain("#C6FF00");
  });
});

describe("getPublicEnv", () => {
  it("returns defaults for local foundation builds", () => {
    const env = getPublicEnv();
    expect(env.appName).toBe("KOBA");
    expect(env.appUrl).toMatch(/^https?:\/\//);
  });
});
