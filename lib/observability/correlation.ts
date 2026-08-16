import { getObservabilityContext } from "@/lib/observability/context";
import { newCorrelationId } from "@/lib/observability/request-id";

/** Prefer the active request/job correlation ID; otherwise mint a bounded one. */
export function resolveCorrelationId(): string {
  return getObservabilityContext().correlationId ?? newCorrelationId();
}
