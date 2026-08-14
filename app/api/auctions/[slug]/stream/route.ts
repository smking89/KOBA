import { auth } from "@/lib/auth";
import { subscribeAuction } from "@/features/auctions/lib/events";
import { getPublicAuction } from "@/features/auctions/services/auction.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await context.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const snapshot = await getPublicAuction(slug, session?.user.id);
      if (snapshot) {
        send(snapshot);
      }

      const unsubscribe = subscribeAuction(slug, () => {
        void getPublicAuction(slug, session?.user.id).then((next) => {
          if (next) {
            send(next);
          }
        });
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
        void getPublicAuction(slug, session?.user.id).then((next) => {
          if (next) {
            send(next);
          }
        });
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

      _request.signal.addEventListener("abort", close);
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
