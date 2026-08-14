import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateGroupForm } from "@/features/groups/components/create-group-form";

export const metadata = { title: "New group" };

export default async function NewGroupPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/groups/new");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create a group</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Anyone with a KOBAID can open a group. Owner, Admin, and Moderator stay group-level
          community roles.
        </p>
      </div>
      <CreateGroupForm />
    </div>
  );
}
