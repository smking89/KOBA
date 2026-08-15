/**
 * Aiden Studio OS — shared shape used at every layer (Master, Category,
 * Agent). Each node in the architecture is an Agent (public entry point) +
 * Kernel (decision logic — validates input, decides what to do) + Engine
 * (does the actual operation) + Sandbox (isolates/bounds that operation).
 * This file defines that shape once; every layer implements it rather than
 * redefining it, so the four are structurally identical everywhere.
 */

export type AidenComponent<Input, Output> = {
  agent: (input: Input) => Promise<Output>;
  kernel: (input: Input) => Promise<Input>;
  engine: (input: Input) => Promise<Output>;
  sandbox: (input: Input) => Promise<Output>;
};

export type AidenComponentName = "agent" | "kernel" | "engine" | "sandbox";

export class AidenOsError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "INVALID" | "ROUTING_FAILED" | "TIMEOUT" | "EXECUTION_FAILED",
    readonly component?: string,
  ) {
    super(message);
    this.name = "AidenOsError";
  }
}
