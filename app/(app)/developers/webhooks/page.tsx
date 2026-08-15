import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeveloperPortalNav } from "@/features/developers/components/developer-portal-nav";
import { CreateWebhookForm } from "@/features/developers/components/webhook-form";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";
import {
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "@/features/developers/services/webhook.service";

export const metadata = { title: "Webhooks" };

export default async function DeveloperWebhooksPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/webhooks");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");
  const [endpoints, deliveries] = await Promise.all([
    listWebhookEndpoints(session.user.id),
    listWebhookDeliveries(session.user.id),
  ]);

  return (
    <div className="space-y-8">
      <DeveloperPortalNav current="/developers/webhooks" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-2 text-sm text-muted">
          HTTPS only. Payloads are HMAC-signed. Loopback and private addresses are rejected. Signing
          secrets are encrypted at rest and never logged.
        </p>
      </div>
      <Card>
        <CardTitle>Register endpoint</CardTitle>
        <CardDescription>Secret is shown once. Rotate to issue a new secret.</CardDescription>
        <div className="mt-4">
          <CreateWebhookForm />
        </div>
      </Card>
      <ul className="space-y-3">
        {endpoints.map((endpoint) => (
          <li
            key={endpoint.publicRef}
            className="rounded-md border border-border bg-surface px-4 py-3"
          >
            <p className="font-mono text-sm">{endpoint.url}</p>
            <p className="text-xs text-muted">
              {endpoint.events.join(", ")} · prefix {endpoint.secretPrefix}
              {endpoint.disabled ? " · disabled" : ""}
            </p>
          </li>
        ))}
      </ul>
      <Card>
        <CardTitle>Recent deliveries</CardTitle>
        <ul className="mt-3 space-y-2 font-mono text-xs text-muted">
          {deliveries.map((row) => (
            <li key={row.deliveryId}>
              {row.deliveryId} · {row.eventType} · {row.status} · attempts {row.attempts}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
