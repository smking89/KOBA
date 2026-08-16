import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listGroups } from "@/features/groups/services/group.service";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const session = await auth();
  const groups = await listGroups(session?.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Groups"
        title="Find your squad"
        description="Public groups are open. Private groups need a request or invite. Group Admin and Moderator are community roles, not KOBA staff."
        actions={
          <Link href="/groups/new" className={cn(buttonVariants())}>
            New group
          </Link>
        }
      />

      {groups.length === 0 ? (
        <EmptyState>No groups yet. Create one after you sign in.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Link key={group.slug} href={`/groups/${group.slug}`} className="block h-full">
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{group.name}</CardTitle>
                  <Badge>{group.visibility}</Badge>
                </div>
                <CardDescription className="mt-2 line-clamp-2">{group.bio}</CardDescription>
                <p className="mt-3 text-xs text-muted">
                  {group.memberCount} members{group.joined ? " · Joined" : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
