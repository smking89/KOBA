import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/koba/empty-state";
import { FeedList } from "@/features/social/components/feed-list";
import { ProfileHero } from "@/features/social/components/profile-hero";
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
      ? { items: [], hasMore: false, page: 1 }
      : await listProfilePosts({ handle: profile.handle, viewerUserId: session?.user.id });

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <ProfileHero profile={profile} signedIn={Boolean(session?.user.id)} />
        {profile.blocked ? (
          <EmptyState>This profile is blocked. Unblock to see public posts.</EmptyState>
        ) : (
          <section className="space-y-3">
            <h2 className="px-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Activity
            </h2>
            <FeedList
              initial={posts}
              signedIn={Boolean(session?.user.id)}
              authorHandle={profile.handle}
              empty="No public posts yet."
            />
          </section>
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
