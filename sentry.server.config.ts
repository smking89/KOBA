import * as Sentry from "@sentry/nextjs";
import {
  isSentryEnabled,
  observabilityEnvironment,
  observabilityRelease,
  sentryDsn,
  sentryTraceSampleRate,
} from "@/lib/observability/config";
import { sentryBeforeSend } from "@/lib/observability/sentry-filter";

const dsn = sentryDsn();
const release = observabilityRelease();

if (isSentryEnabled() && dsn) {
  Sentry.init({
    dsn,
    environment: observabilityEnvironment(),
    tracesSampleRate: sentryTraceSampleRate(),
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    ...(release ? { release } : {}),
  });
}
