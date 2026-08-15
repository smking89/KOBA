import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
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
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1>
              <Badge>@{profile.handle}</Badge>
            </div>
            {profile.kobaId ? (
              <p className="mt-2 font-mono text-sm text-muted">{profile.kobaId}</p>
            ) : null}
            {profile.bio ? (
              <p className="mt-3 max-w-xl text-sm leading-relaxed">{profile.bio}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              {profile.followers} followers · {profile.following} following · {profile.posts} public
              posts
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
