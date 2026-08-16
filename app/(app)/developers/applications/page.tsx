import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeveloperPortalNav } from "@/features/developers/components/developer-portal-nav";
import { CreateApplicationForm } from "@/features/developers/components/developer-forms";
import {
  getMyDeveloperProfile,
  listDeveloperApplications,
} from "@/features/developers/services/portal.service";

export const metadata = { title: "Developer applications" };

export default async function DeveloperApplicationsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/applications");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");
  const apps = await listDeveloperApplications(session.user.id);

  return (
    <div className="space-y-8">
      <DeveloperPortalNav current="/developers/applications" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-2 text-sm text-muted">
          Sandbox apps can be created by developers. Production access requires staff approval.
          OAuth authorization-code flow is deferred — redirect URIs are stored only.
        </p>
      </div>
      <Card>
        <CardTitle>New sandbox app</CardTitle>
        <CardDescription>Read-only scopes. No write or staff access.</CardDescription>
        <div className="mt-4">
          <CreateApplicationForm />
        </div>
      </Card>
      <ul className="grid gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <li key={app.publicRef}>
            <Card>
              <CardTitle>{app.name}</CardTitle>
              <CardDescription>
                {app.environment} · {app.status}
              </CardDescription>
              <Link
                href={`/developers/applications/${app.publicRef}`}
                className="mt-3 inline-flex text-sm text-neon-lime"
              >
                Open
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
