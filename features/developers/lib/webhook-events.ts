export const DEV_WEBHOOK_EVENTS = [
  "order.created",
  "order.completed",
  "order.refunded",
  "product.updated",
  "server.status_changed",
] as const;

export type DevWebhookEvent = (typeof DEV_WEBHOOK_EVENTS)[number];

export const DEV_WEBHOOK_PAYLOAD_VERSION = 1;

export function isDevWebhookEvent(value: string): value is DevWebhookEvent {
  return (DEV_WEBHOOK_EVENTS as readonly string[]).includes(value);
}
