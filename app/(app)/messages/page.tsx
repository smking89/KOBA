import { redirect } from "next/navigation";
import { PageHeader } from "@/components/koba/page-header";
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
      <PageHeader
        eyebrow="Private"
        title="Messages"
        description="Direct chats are never cached by the PWA. Vanish mode deletes server copies when you leave — it cannot stop screenshots."
      />
      <InboxList initial={items} />
    </div>
  );
}
