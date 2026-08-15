import * as Sentry from "@sentry/nextjs";
import {
  observabilityEnvironment,
  observabilityRelease,
  sentryTraceSampleRate,
} from "@/lib/observability/config";
import { sentryBeforeSend } from "@/lib/observability/sentry-filter";
import { browserSentryDsn, isBrowserSentryEnabled } from "@/lib/observability/sentry-public";

const dsn = browserSentryDsn();
const release = observabilityRelease();

if (isBrowserSentryEnabled() && dsn) {
  Sentry.init({
    dsn,
    environment: observabilityEnvironment(),
    tracesSampleRate: sentryTraceSampleRate(),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    ...(release ? { release } : {}),
  });
}
