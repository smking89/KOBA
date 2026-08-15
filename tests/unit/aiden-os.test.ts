import { describe, expect, it } from "vitest";
import { normalizeTaskRequest } from "@/features/aiden/os/orchestration/task-router";
import { resolveCategory } from "@/features/aiden/os/orchestration/category-router";
import { resolveAgentId } from "@/features/aiden/os/orchestration/agent-router";
import { route } from "@/features/aiden/os/orchestration/orchestration-layer";
import { composeComponent } from "@/features/aiden/os/shared/compose";
import { runInSandbox } from "@/features/aiden/os/shared/sandbox";
import { AidenOsError } from "@/features/aiden/os/shared/types";
import { masterAgent } from "@/features/aiden/os";
import { productForAssetType, productLabel } from "@/features/aiden/providers/types";
import { usdToCoins } from "@/features/aiden/lib/cost";

describe("task router", () => {
  it("accepts a well-formed <category>.<agent> task type", () => {
    expect(normalizeTaskRequest({ taskType: "generation.vest", payload: { a: 1 } })).toEqual({
      taskType: "generation.vest",
      payload: { a: 1 },
    });
  });

  it("rejects malformed task types", () => {
    expect(() => normalizeTaskRequest({ taskType: "", payload: null })).toThrow(AidenOsError);
    expect(() => normalizeTaskRequest({ taskType: "Generation.Vest", payload: null })).toThrow();
    expect(() => normalizeTaskRequest({ taskType: "generation", payload: null })).toThrow();
    expect(() => normalizeTaskRequest({ taskType: 42, payload: null })).toThrow();
  });
});

describe("category router", () => {
  it("maps known prefixes to categories", () => {
    expect(resolveCategory({ taskType: "generation.vest", payload: null })).toBe("GENERATION");
    expect(resolveCategory({ taskType: "logic.something", payload: null })).toBe("LOGIC");
    expect(resolveCategory({ taskType: "data.something", payload: null })).toBe("DATA");
    expect(resolveCategory({ taskType: "automation.something", payload: null })).toBe("AUTOMATION");
    expect(resolveCategory({ taskType: "interface.something", payload: null })).toBe("INTERFACE");
  });

  it("rejects an unmapped prefix", () => {
    expect(() => resolveCategory({ taskType: "unknown.thing", payload: null })).toThrow(
      AidenOsError,
    );
  });
});

describe("agent router", () => {
  it("extracts the agent id from the task type", () => {
    expect(resolveAgentId({ taskType: "generation.vest", payload: null })).toBe("vest");
  });
});

describe("orchestration layer", () => {
  it("composes task/category/agent routing end to end", () => {
    const { task, decision } = route({ taskType: "generation.terra", payload: { prompt: "x" } });
    expect(task.taskType).toBe("generation.terra");
    expect(decision).toEqual({ category: "GENERATION", agentId: "terra" });
  });
});

describe("component composition (Agent/Kernel/Engine/Sandbox)", () => {
  it("runs kernel before engine, and agent returns the engine's result", async () => {
    const calls: string[] = [];
    const component = composeComponent<number, number>({
      label: "test",
      kernel: async (input) => {
        calls.push("kernel");
        return input + 1;
      },
      engine: async (input) => {
        calls.push("engine");
        return input * 2;
      },
    });

    const result = await component.agent(5);
    expect(result).toBe(12); // (5 + 1) * 2
    expect(calls).toEqual(["kernel", "engine"]);
  });

  it("normalizes a thrown non-AidenOsError into an AidenOsError", async () => {
    const component = composeComponent<undefined, never>({
      label: "boom",
      kernel: async (input) => input,
      engine: async () => {
        throw new Error("vendor exploded");
      },
    });

    await expect(component.agent(undefined)).rejects.toThrow(AidenOsError);
    await expect(component.agent(undefined)).rejects.toThrow(/vendor exploded/);
  });

  it("preserves a thrown AidenOsError's code rather than re-wrapping it", async () => {
    const component = composeComponent<undefined, never>({
      label: "not-configured",
      kernel: async (input) => input,
      engine: async () => {
        throw new AidenOsError("nope", "NOT_CONFIGURED");
      },
    });

    try {
      await component.agent(undefined);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AidenOsError);
      expect((error as AidenOsError).code).toBe("NOT_CONFIGURED");
    }
  });
});

describe("sandbox timeout", () => {
  it("times out a slow engine and reports AidenOsError TIMEOUT", async () => {
    await expect(
      runInSandbox(() => new Promise((resolve) => setTimeout(resolve, 200)), {
        label: "slow",
        timeoutMs: 20,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("resolves normally when well within the timeout", async () => {
    const result = await runInSandbox(() => Promise.resolve(42), { label: "fast", timeoutMs: 500 });
    expect(result).toBe(42);
  });
});

describe("Aiden product mapping (Vest/Graft/Terra)", () => {
  it("maps every asset type to exactly one product", () => {
    expect(productForAssetType("SKIN")).toBe("VEST");
    expect(productForAssetType("CONCEPT_IMAGE")).toBe("VEST");
    expect(productForAssetType("TEXTURE")).toBe("GRAFT");
    expect(productForAssetType("PROP")).toBe("GRAFT");
    expect(productForAssetType("ANIMATION")).toBe("GRAFT");
    expect(productForAssetType("TERRAIN")).toBe("TERRA");
    expect(productForAssetType("MAP")).toBe("TERRA");
  });

  it("labels each product", () => {
    expect(productLabel("VEST")).toBe("Vest");
    expect(productLabel("GRAFT")).toBe("Graft");
    expect(productLabel("TERRA")).toBe("Terra");
  });
});

describe("USD to Coin cost conversion", () => {
  it("converts at KOBA's own cost basis ($0.10 = 1 Coin)", () => {
    expect(usdToCoins(1)).toBe(10);
    expect(usdToCoins(0.5)).toBe(5);
  });

  it("rounds up fractional cents so KOBA never under-charges", () => {
    expect(usdToCoins(0.001)).toBe(1);
  });

  it("rejects negative or non-finite cost", () => {
    expect(() => usdToCoins(-1)).toThrow(RangeError);
    expect(() => usdToCoins(Number.NaN)).toThrow(RangeError);
    expect(() => usdToCoins(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("MasterAgent end to end (no vendor configured)", () => {
  it("routes generation.vest through the real pipeline and fails closed with a clear reason", async () => {
    await expect(
      masterAgent.agent({
        taskType: "generation.vest",
        payload: { prompt: "x", game: "Rust", platform: "STEAM", assetType: "SKIN" },
      }),
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
      message: expect.stringContaining("vest"),
    });
  });

  it("rejects an unroutable task type before touching any agent", async () => {
    await expect(masterAgent.agent({ taskType: "generation", payload: {} })).rejects.toThrow(
      AidenOsError,
    );
  });
});
