import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CreatePublisherForm } from "@/features/developers/components/developer-forms";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";

export const metadata = { title: "Create publisher" };

export default async function NewDeveloperPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/new");
  const existing = await getMyDeveloperProfile(session.user.id).catch(() => null);
  if (existing) redirect("/developers/dashboard");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create a publisher</h1>
        <p className="mt-2 text-sm text-muted">
          Staff must verify publishers. You cannot self-verify. Contact email stays private.
        </p>
      </div>
      <Card>
        <CardTitle>Publisher profile</CardTitle>
        <CardDescription>Requires a Player, Business, or Influencer KOBAID.</CardDescription>
        <div className="mt-4">
          <CreatePublisherForm />
        </div>
      </Card>
    </div>
  );
}
