import { auth } from "@/lib/auth";
import { subscribeConversation } from "@/features/messages/lib/events";
import { MessageError } from "@/features/messages/lib/errors";
import { getThread } from "@/features/messages/services/message.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const { ref } = await context.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const pushSnapshot = async () => {
        const thread = await getThread(userId, ref);
        send({ type: "snapshot", thread });
      };

      try {
        await pushSnapshot();
      } catch (error) {
        if (error instanceof MessageError) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`),
          );
        }
        controller.close();
        return;
      }

      const unsubscribe = subscribeConversation(ref, () => {
        void pushSnapshot().catch(() => {
          /* membership may have changed */
        });
      });
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, 4000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
