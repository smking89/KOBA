import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getDeveloperApplication } from "@/features/developers/services/portal.service";

export const metadata = { title: "Application" };

export default async function DeveloperApplicationDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const { appId } = await params;
  const app = await getDeveloperApplication(session.user.id, appId).catch(() => null);
  if (!app) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {app.environment} · {app.status} · OAuth {app.oauth}
        </p>
      </div>
      <Card>
        <CardTitle>Scopes</CardTitle>
        <CardDescription>{app.scopes.join(", ") || "None"}</CardDescription>
        <p className="mt-3 text-xs text-muted">
          Redirect URIs: {app.redirectUris.join(", ") || "—"}
        </p>
      </Card>
      <Card>
        <CardTitle>Keys</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {app.keys.map((key) => (
            <li key={key.prefix} className="font-mono text-muted">
              {key.prefix} · {key.revoked ? "revoked" : "active"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
