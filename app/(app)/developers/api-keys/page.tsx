import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeveloperPortalNav } from "@/features/developers/components/developer-portal-nav";
import { CreateApiKeyForm } from "@/features/developers/components/developer-forms";
import {
  getMyDeveloperProfile,
  listDeveloperApiKeys,
  listDeveloperApplications,
} from "@/features/developers/services/portal.service";

export const metadata = { title: "API keys" };

export default async function DeveloperApiKeysPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/api-keys");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");
  const [keys, apps] = await Promise.all([
    listDeveloperApiKeys(session.user.id),
    listDeveloperApplications(session.user.id),
  ]);

  return (
    <div className="space-y-8">
      <DeveloperPortalNav current="/developers/api-keys" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-2 text-sm text-muted">
          Secrets are hashed with SHA-256, shown once, and never returned by list endpoints. Use
          Authorization: Bearer koba_sandbox_… or koba_live_….
        </p>
      </div>
      <Card>
        <CardTitle>Generate</CardTitle>
        <CardDescription>
          OWNER and ADMIN only. Production keys need staff approval.
        </CardDescription>
        <div className="mt-4">
          <CreateApiKeyForm applications={apps} />
        </div>
      </Card>
      <ul className="space-y-3">
        {keys.map((key) => (
          <li key={key.prefix} className="rounded-md border border-border bg-surface px-4 py-3">
            <p className="font-medium">{key.name}</p>
            <p className="font-mono text-xs text-muted">
              {key.prefix} · {key.environment} · {key.revokedAt ? "revoked" : "active"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
