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
  it("exposes the fire red/orange/gold dark brand palette", () => {
    expect(kobaTokens.background).toBe("#050505");
    expect(kobaTokens.neonLime).toBe("#FF5A1F");
    expect(kobaTokens.brandGradient).toContain("#F5341E");
  });
});

describe("getPublicEnv", () => {
  it("returns defaults for local foundation builds", () => {
    const env = getPublicEnv();
    expect(env.appName).toBe("KOBA");
    expect(env.appUrl).toMatch(/^https?:\/\//);
  });
});
