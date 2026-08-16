import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { HexAvatar } from "@/components/koba/hex-avatar";
import { cn } from "@/lib/utils";
import { listGroups } from "@/features/groups/services/group.service";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const session = await auth();
  const groups = await listGroups(session?.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="live">Groups</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Find your squad</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Public groups are open. Private groups need a request or invite. Group Admin and
            Moderator are community roles, not KOBA staff.
          </p>
        </div>
        <Link href="/groups/new" className={cn(buttonVariants())}>
          New group
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">No groups yet. Create one after you sign in.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Link key={group.slug} href={`/groups/${group.slug}`}>
              <Card className="border-t-2 border-t-neon-lime">
                <div className="flex items-start gap-3">
                  <HexAvatar name={group.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate">{group.name}</CardTitle>
                      <Badge>{group.visibility}</Badge>
                    </div>
                    <CardDescription className="mt-1 line-clamp-2">{group.bio}</CardDescription>
                    <p className="mt-3 text-xs text-muted">
                      {group.memberCount} members{group.joined ? " · Joined" : ""}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
