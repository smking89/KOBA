import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ThreadView } from "@/features/messages/components/thread-view";
import { MessageError } from "@/features/messages/lib/errors";
import { getThread } from "@/features/messages/services/message.service";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/messages");
  }
  const { ref } = await params;

  try {
    const thread = await getThread(session.user.id, ref);
    return <ThreadView initial={thread} />;
  } catch (error) {
    if (error instanceof MessageError && (error.code === "NOT_FOUND" || error.code === "BLOCKED")) {
      notFound();
    }
    throw error;
  }
}
