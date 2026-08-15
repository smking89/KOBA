import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeveloperPortalNav } from "@/features/developers/components/developer-portal-nav";
import { CreateProductForm } from "@/features/developers/components/developer-forms";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";

export const metadata = { title: "New developer product" };

export default async function NewDeveloperProductPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/products/new");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");

  return (
    <div className="space-y-8">
      <DeveloperPortalNav current="/developers/products" />
      <Card>
        <CardTitle>New product</CardTitle>
        <CardDescription>
          Uploaded artifacts are quarantined. KOBA never runs third-party code.
        </CardDescription>
        <div className="mt-4">
          <CreateProductForm />
        </div>
      </Card>
    </div>
  );
}
