import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/koba/empty-state";
import { FeedList } from "@/features/social/components/feed-list";
import { ProfileHero } from "@/features/social/components/profile-hero";
import { SocialError } from "@/features/social/lib/errors";
import { listProfilePosts } from "@/features/social/services/post.service";
import { getProfileByHandle } from "@/features/social/services/profile.service";
import { AchievementBadgeGrid } from "@/features/achievements/components/achievement-badge-grid";
import { AchievementConfetti } from "@/features/achievements/components/achievement-confetti";
import {
  evaluateAndGrantAchievements,
  listUserAchievements,
} from "@/features/achievements/services/achievement.service";

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

    // Only the profile owner's own page-load evaluates+grants new badges —
    // avoids running achievement criteria queries on every visitor page
    // view, and matches "when a badge is unlocked" being a self-experience
    // (confetti fires for the person who earned it, not their viewers).
    const newlyUnlocked = profile.isSelf ? await evaluateAndGrantAchievements(profile.userId) : [];
    const unlocked = await listUserAchievements(profile.userId);

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {newlyUnlocked.length > 0 ? <AchievementConfetti unlocked={newlyUnlocked} /> : null}
        <ProfileHero profile={profile} signedIn={Boolean(session?.user.id)} />
        <section className="space-y-3 rounded-xl border border-white/[0.06] bg-surface-3 p-4 shadow-soft">
          <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Badges</h2>
          <AchievementBadgeGrid unlockedSlugs={unlocked.map((badge) => badge.slug)} />
        </section>
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
