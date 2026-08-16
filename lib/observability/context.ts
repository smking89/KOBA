import { AsyncLocalStorage } from "node:async_hooks";

export type ObservabilityContext = {
  requestId?: string;
  correlationId?: string;
  route?: string;
  jobId?: string;
  worker?: string;
  errorId?: string;
  captured?: boolean;
};

const storage = new AsyncLocalStorage<ObservabilityContext>();

export function getObservabilityContext(): ObservabilityContext {
  return storage.getStore() ?? {};
}

export function runWithObservabilityContext<T>(context: ObservabilityContext, fn: () => T): T {
  const parent = storage.getStore() ?? {};
  return storage.run({ ...parent, ...context, captured: parent.captured ?? false }, fn);
}

export function markCaptured(): void {
  const current = storage.getStore();
  if (current) current.captured = true;
}

export function wasCaptured(): boolean {
  return Boolean(storage.getStore()?.captured);
}
