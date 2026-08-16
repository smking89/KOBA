import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { HexAvatar } from "@/components/koba/hex-avatar";
import { BlockButton } from "@/features/social/components/block-button";
import { FeedList } from "@/features/social/components/feed-list";
import { FollowButton } from "@/features/social/components/follow-button";
import { MessageButton } from "@/features/messages/components/message-button";
import { SocialError } from "@/features/social/lib/errors";
import { listProfilePosts } from "@/features/social/services/post.service";
import { getProfileByHandle } from "@/features/social/services/profile.service";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  try {
    const session = await auth();
    const profile = await getProfileByHandle(handle, session?.user.id);
    return { title: `@${profile.handle}` };
  } catch {
    return { title: "Profile" };
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const session = await auth();

  try {
    const profile = await getProfileByHandle(handle, session?.user.id);
    const posts = profile.blocked
      ? { items: [], hasMore: false, nextCursor: null }
      : await listProfilePosts({ handle: profile.handle, viewerUserId: session?.user.id });

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-28 rounded-2xl bg-brand-gradient md:h-36" />

        <header className="-mt-14 flex flex-wrap items-end justify-between gap-4 px-2 md:-mt-16">
          <div className="flex items-end gap-4">
            <HexAvatar name={profile.name} size="lg" badge={profile.plusBadgeLabel} />
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
                <Badge>@{profile.handle}</Badge>
              </div>
              {profile.kobaId ? (
                <p className="font-mono text-xs text-muted">{profile.kobaId}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            <FollowButton
              handle={profile.handle}
              signedIn={Boolean(session?.user.id)}
              isSelf={profile.isSelf}
              initialFollowing={profile.followingThem}
            />
            <MessageButton
              handle={profile.handle}
              signedIn={Boolean(session?.user.id)}
              isSelf={profile.isSelf}
              blocked={profile.blocked}
            />
            <BlockButton
              handle={profile.handle}
              signedIn={Boolean(session?.user.id)}
              isSelf={profile.isSelf}
              initialBlocked={profile.blocked}
            />
          </div>
        </header>

        {profile.bio ? <p className="px-2 text-sm leading-relaxed">{profile.bio}</p> : null}

        <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface text-center">
          <div className="px-2 py-3">
            <p className="text-xl font-bold">{profile.posts}</p>
            <p className="text-[0.65rem] tracking-wide text-muted uppercase">Posts</p>
          </div>
          <div className="px-2 py-3">
            <p className="text-xl font-bold">{profile.followers}</p>
            <p className="text-[0.65rem] tracking-wide text-muted uppercase">Followers</p>
          </div>
          <div className="px-2 py-3">
            <p className="text-xl font-bold">{profile.following}</p>
            <p className="text-[0.65rem] tracking-wide text-muted uppercase">Following</p>
          </div>
        </div>

        {profile.blocked ? (
          <p className="text-sm text-muted">This profile is blocked.</p>
        ) : (
          <FeedList initial={posts} signedIn={Boolean(session?.user.id)} />
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof SocialError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
