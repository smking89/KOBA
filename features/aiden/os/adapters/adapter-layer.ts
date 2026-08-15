import type { AidenComponent } from "@/features/aiden/os/shared/types";
import { AidenOsError } from "@/features/aiden/os/shared/types";

export const ADAPTER_KINDS = [
  "LOCAL_MODEL",
  "EXTERNAL_MODEL",
  "AGENT",
  "TOOL",
  "WORKFLOW",
] as const;
export type AdapterKind = (typeof ADAPTER_KINDS)[number];

type RegistryKey = `${AdapterKind}:${string}`;

/**
 * Adien.AdapterLayer: the registry every wrapped component (local model,
 * external model, custom agent, tool, or workflow) is plugged into. This
 * is what makes the "plug-n-play" requirement real — anything registered
 * here is addressable by OrchestrationLayer the same way, regardless of
 * what kind of thing it actually is underneath.
 */
const registry = new Map<RegistryKey, AidenComponent<unknown, unknown>>();

function key(kind: AdapterKind, id: string): RegistryKey {
  return `${kind}:${id}`;
}

export function registerAdapter(
  kind: AdapterKind,
  id: string,
  component: AidenComponent<unknown, unknown>,
): void {
  registry.set(key(kind, id), component);
}

export function getAdapter(kind: AdapterKind, id: string): AidenComponent<unknown, unknown> {
  const found = registry.get(key(kind, id));
  if (!found) {
    throw new AidenOsError(`No ${kind} adapter registered for "${id}".`, "NOT_CONFIGURED");
  }
  return found;
}

export function hasAdapter(kind: AdapterKind, id: string): boolean {
  return registry.has(key(kind, id));
}

/** Test-only: clears the registry between test runs. */
export function resetAdapterLayer(): void {
  registry.clear();
}
