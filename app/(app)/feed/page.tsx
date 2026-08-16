import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/koba/page-header";
import { FeedList } from "@/features/social/components/feed-list";
import { PostComposer } from "@/features/social/components/post-composer";
import { StoryTray } from "@/features/social/components/story-tray";
import { listFeed, listStories } from "@/features/social/services/post.service";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user.id);
  const [feed, stories] = await Promise.all([
    listFeed({ viewerUserId: session?.user.id }),
    listStories(session?.user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Live"
        title="Feed"
        description="Follow people, tag shops and groups, and report content for staff review. Stories expire after 24 hours."
      />
      <StoryTray stories={stories} signedIn={signedIn} />
      {signedIn ? <PostComposer /> : null}
      <FeedList initial={feed} signedIn={signedIn} />
    </div>
  );
}
