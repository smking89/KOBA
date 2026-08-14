import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { InboxList } from "@/features/messages/components/inbox-list";
import { listInbox } from "@/features/messages/services/message.service";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/messages");
  }

  const items = await listInbox(session.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Badge tone="live">Private</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Direct chats are never cached by the PWA. Vanish mode deletes server copies when you leave
          — it cannot stop screenshots.
        </p>
      </div>
      <InboxList initial={items} />
    </div>
  );
}
