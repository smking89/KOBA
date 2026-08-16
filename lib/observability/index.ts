export {
  isSentryEnabled,
  isValidRequestId,
  observabilityEnvironment,
  observabilityRelease,
  REQUEST_ID_HEADER,
  ERROR_ID_HEADER,
  sentryDsn,
  sentryTraceSampleRate,
  serviceName,
} from "@/lib/observability/config";
export { redactHeaders, redactValue, isSensitiveKey } from "@/lib/observability/redact";
export {
  newCorrelationId,
  newErrorId,
  newRequestId,
  resolveRequestId,
} from "@/lib/observability/request-id";
export {
  AppError,
  classifyError,
  isExpectedNoise,
  type ErrorCategory,
} from "@/lib/observability/taxonomy";
export { logger } from "@/lib/observability/logger";
export { captureException, safeErrorResponse, safeErrorJson } from "@/lib/observability/capture";
export {
  emitAlert,
  recordStaffMfaFailure,
  recordRconFailure,
  resetAlertWindowsForTests,
  ALERT_EVENTS,
} from "@/lib/observability/alerts";
export { unexpectedJsonError } from "@/lib/observability/http";
export { resolveCorrelationId } from "@/lib/observability/correlation";
export { isBrowserSentryEnabled } from "@/lib/observability/sentry-public";
export {
  getWorkerHeartbeat,
  isWorkerStale,
  listWorkerHeartbeats,
  recordWorkerHeartbeat,
  resetWorkerHeartbeatsForTests,
} from "@/lib/observability/heartbeat";
export { runWithObservabilityContext, getObservabilityContext } from "@/lib/observability/context";
export { sentryBeforeSend, shouldDropError } from "@/lib/observability/sentry-filter";
export {
  composeReadiness,
  getLiveness,
  getReadiness,
  optionalServiceStates,
} from "@/lib/observability/readiness";
export { runWorkerMain } from "@/lib/observability/worker-main";
