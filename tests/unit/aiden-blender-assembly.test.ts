import { describe, expect, it, afterEach } from "vitest";
import {
  isBlenderConfigured,
  blenderBinaryPath,
  buildBlenderArgs,
  AidenBlenderNotConfiguredError,
} from "@/features/aiden/lib/blender-assembly";

// KOBA Aiden pipeline (client, 2026-08-18): the Blender assembly step
// combines a Tripo mesh with three Kandinsky PBR maps into one
// exported .glb. Real Blender execution can't be exercised in this
// environment (no Blender binary available in this sandbox) — these
// tests cover what *is* verifiable without spawning a real process:
// the fail-closed configuration gate and the exact command shape
// Blender gets invoked with. scripts/aiden/assemble_skin.py's actual
// 3D output needs a real smoke test once Blender is installed on the
// target VPS.

const ENV_VAR = "AIDEN_BLENDER_BINARY";

describe("isBlenderConfigured — fails closed like every other Aiden provider", () => {
  const original = process.env[ENV_VAR];

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = original;
  });

  it("is unconfigured when the env var is unset", () => {
    delete process.env[ENV_VAR];
    expect(isBlenderConfigured()).toBe(false);
  });

  it("is unconfigured when the env var is an obvious placeholder", () => {
    process.env[ENV_VAR] = "replace_me";
    expect(isBlenderConfigured()).toBe(false);
  });

  it("is configured once a real-looking path is set", () => {
    process.env[ENV_VAR] = "/usr/bin/blender";
    expect(isBlenderConfigured()).toBe(true);
    expect(blenderBinaryPath()).toBe("/usr/bin/blender");
  });
});

describe("buildBlenderArgs — exact command shape", () => {
  it("runs headless, background, pointed at the assembly script and workdir", () => {
    const args = buildBlenderArgs("/tmp/aiden-blender-abc123");
    expect(args[0]).toBe("--background");
    expect(args).toContain("--python");
    expect(args).toContain("--");
    expect(args).toContain("--workdir");
    expect(args).toContain("/tmp/aiden-blender-abc123");
    // The script path comes right after --python.
    const scriptIndex = args.indexOf("--python") + 1;
    expect(args[scriptIndex]).toMatch(/assemble_skin\.py$/);
  });
});

describe("AidenBlenderNotConfiguredError", () => {
  it("names the env var a fixer needs to set", () => {
    const error = new AidenBlenderNotConfiguredError();
    expect(error.message).toContain("AIDEN_BLENDER_BINARY");
    expect(error.name).toBe("AidenBlenderNotConfiguredError");
  });
});

describe("buildPbrMapPrompts — Kandinsky map prompts stay distinct per channel", () => {
  it("appends a different technical suffix per map type, not one shared vague suffix", async () => {
    const { buildPbrMapPrompts } = await import("@/features/aiden/lib/pbr-maps");
    const prompts = buildPbrMapPrompts("cyberpunk jacket, neon trim");

    expect(prompts.normal).toContain("cyberpunk jacket, neon trim");
    expect(prompts.normal).toContain("normal map");
    expect(prompts.specular).toContain("specular");
    expect(prompts.emission).toContain("emission mask");

    // The three prompts must actually differ — a shared suffix would
    // produce three near-identical "shiny" images instead of the
    // distinct per-channel data each map needs.
    expect(prompts.normal).not.toBe(prompts.specular);
    expect(prompts.specular).not.toBe(prompts.emission);
  });
});
