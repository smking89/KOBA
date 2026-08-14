import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { GroupError } from "@/features/groups/lib/errors";
import { getGroup } from "@/features/groups/services/group.service";
import { GroupJoinButton } from "@/features/groups/components/group-join-button";
import { GroupModeratePanel } from "@/features/groups/components/group-moderate-panel";
import { GroupMemberActions } from "@/features/groups/components/group-member-actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const session = await auth();
    const group = await getGroup(slug, session?.user.id);
    return { title: group.name };
  } catch {
    return { title: "Group" };
  }
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  try {
    const group = await getGroup(slug, session?.user.id);

    return (
      <div className="space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
              <Badge>{group.visibility}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {group.memberCount} members · Tagging: {group.taggingAllowed ? "Allowed" : "Off"}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">{group.bio}</p>
          </div>
          <GroupJoinButton
            slug={group.slug}
            signedIn={Boolean(session?.user.id)}
            joined={group.joined}
            banned={group.banned}
            pendingRequest={group.pendingRequest}
            pendingInvite={group.pendingInvite}
            isOwner={group.viewerRole === "OWNER"}
            visibility={group.visibility}
          />
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Owner, Admin, and Moderator are group community roles — not KOBA staff.
            </CardDescription>
            <ul className="mt-4 space-y-3 text-sm">
              {group.members.map((member) => (
                <li
                  key={`${member.role}-${member.kobaId ?? member.name}`}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    {member.name} <Badge>{member.role}</Badge>
                    {member.kobaId ? (
                      <span className="ml-2 font-mono text-xs text-muted">{member.kobaId}</span>
                    ) : null}
                  </span>
                  <GroupMemberActions
                    slug={group.slug}
                    kobaId={member.kobaId}
                    role={member.role}
                    viewerRole={group.viewerRole}
                  />
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4">
            <GroupModeratePanel
              slug={group.slug}
              canInvite={group.canInvite}
              canModerate={group.canModerate}
              requests={group.requests}
              bans={group.bans}
            />
            <Card>
              <CardTitle>Group feed</CardTitle>
              <CardDescription>
                Posts, tags, and stories ship with the social system. Membership and roles are live
                now.
              </CardDescription>
            </Card>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof GroupError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
