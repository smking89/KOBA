import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SocialError } from "@/features/social/lib/errors";
import { getStory } from "@/features/social/services/post.service";

export const metadata = { title: "Story" };

export default async function StoryPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const session = await auth();

  try {
    const story = await getStory(ref, session?.user.id);
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card>
          <CardTitle>
            <Link href={`/u/${story.author.handle}`} className="hover:text-neon-lime">
              @{story.author.handle}
            </Link>
          </CardTitle>
          <CardDescription>Expires {new Date(story.expiresAt).toLocaleString()}</CardDescription>
          <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed">{story.body}</p>
        </Card>
        <Link href="/feed" className="text-sm text-muted hover:text-foreground">
          Back to feed
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof SocialError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
