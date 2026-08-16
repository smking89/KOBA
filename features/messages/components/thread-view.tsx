"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VANISH_LIMITATIONS } from "@/features/messages/lib/rules";

export type ThreadMessage = {
  publicRef: string;
  kind: string;
  body: string | null;
  vanish: boolean;
  mediaUrl: string | null;
  mediaDurationMs: number | null;
  productSlug: string | null;
  fromSelf: boolean;
  createdAt: string;
};

export type ThreadData = {
  publicRef: string;
  vanishMode: boolean;
  peer: { handle: string; name: string; kobaId: string | null };
  typing: string | null;
  messages: ThreadMessage[];
};

export function ThreadView({ initial }: { initial: ThreadData }) {
  const router = useRouter();
  const [thread, setThread] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/messages/${initial.publicRef}/read`, { method: "POST" });
    const source = new EventSource(`/api/messages/${initial.publicRef}/stream`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; thread?: ThreadData };
        if (payload.type === "snapshot" && payload.thread) {
          setThread(payload.thread);
        }
      } catch {
        /* ignore malformed */
      }
    };
    const purgeOnLeave = () => {
      void fetch(`/api/messages/${initial.publicRef}/leave`, {
        method: "POST",
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", purgeOnLeave);
    return () => {
      source.close();
      window.removeEventListener("pagehide", purgeOnLeave);
    };
  }, [initial.publicRef]);

  async function send() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/messages/${thread.publicRef}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "TEXT", body }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send.");
      return;
    }
    setBody("");
  }

  async function toggleVanish() {
    const response = await fetch(`/api/messages/${thread.publicRef}/vanish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vanishMode: !thread.vanishMode }),
    });
    if (!response.ok) {
      setError("Could not update vanish mode.");
    }
  }

  async function report() {
    await fetch(`/api/messages/${thread.publicRef}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Reported from direct messages for staff review." }),
    });
    setError("Report filed for staff review.");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <Link
            href={`/u/${thread.peer.handle}`}
            className="text-lg font-semibold hover:text-neon-lime"
          >
            {thread.peer.name}
          </Link>
          <p className="text-sm text-muted">@{thread.peer.handle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              disabled
              aria-label="Voice call — coming soon"
              title="Voice calls ship later"
              className="h-9 w-9 p-0"
            >
              <Phone className="h-4 w-4" aria-hidden />
            </Button>
            <span className="absolute -top-1.5 -right-1.5 rounded-full bg-neon-lime px-1 text-[0.55rem] leading-tight font-bold text-background">
              Soon
            </span>
          </div>
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              disabled
              aria-label="Video call — coming soon"
              title="Video calls ship later"
              className="h-9 w-9 p-0"
            >
              <Video className="h-4 w-4" aria-hidden />
            </Button>
            <span className="absolute -top-1.5 -right-1.5 rounded-full bg-neon-lime px-1 text-[0.55rem] leading-tight font-bold text-background">
              Soon
            </span>
          </div>
          <Button
            size="sm"
            variant={thread.vanishMode ? "secondary" : "ghost"}
            onClick={() => void toggleVanish()}
          >
            {thread.vanishMode ? "Vanish on" : "Vanish"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void report()}>
            Report
          </Button>
          <button
            type="button"
            className="text-sm text-muted hover:text-foreground"
            onClick={() => {
              void fetch(`/api/messages/${thread.publicRef}/leave`, { method: "POST" }).then(() =>
                router.push("/messages"),
              );
            }}
          >
            Inbox
          </button>
        </div>
      </header>

      {thread.vanishMode ? (
        <p className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
          Vanish Mode is on — messages disappear after you leave the chat. {VANISH_LIMITATIONS}
        </p>
      ) : null}

      <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto py-2">
        {thread.messages.map((message) => (
          <div
            key={message.publicRef}
            className={
              message.fromSelf
                ? "ml-auto max-w-[80%] rounded-2xl bg-brand-gradient px-3 py-2 text-sm text-background"
                : "mr-auto max-w-[80%] rounded-2xl border border-border bg-surface px-3 py-2 text-sm"
            }
          >
            {message.vanish ? (
              <p
                className={`mb-1 text-[0.65rem] ${message.fromSelf ? "opacity-80" : "text-muted"}`}
              >
                Vanish
              </p>
            ) : null}
            {message.kind === "VOICE" ? (
              <p>
                Voice note
                {message.mediaDurationMs
                  ? ` · ${(message.mediaDurationMs / 1000).toFixed(0)}s`
                  : ""}
                {message.mediaUrl ? (
                  <>
                    {" · "}
                    <a
                      href={message.mediaUrl}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            {message.kind === "PRODUCT" && message.productSlug ? (
              <Link href={`/market/${message.productSlug}`} className="underline">
                Product · {message.productSlug}
              </Link>
            ) : null}
            {message.kind === "ATTACHMENT" && message.mediaUrl ? (
              <a href={message.mediaUrl} className="underline" target="_blank" rel="noreferrer">
                Attachment
              </a>
            ) : null}
            {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
          </div>
        ))}
        {thread.typing ? <p className="text-xs text-muted">@{thread.typing} is typing…</p> : null}
      </div>

      <form
        className="mt-3 flex gap-2 border-t border-border pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim()) {
            void send();
          }
        }}
      >
        <Input
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            void fetch(`/api/messages/${thread.publicRef}/typing`, { method: "POST" });
          }}
          placeholder={`Message ${thread.peer.handle}…`}
          maxLength={2000}
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          Send
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <p className="mt-2 text-xs text-muted">
        Voice notes accept https media URLs only in this phase — binary uploads come later.
      </p>
      <button
        type="button"
        className="mt-2 text-left text-xs text-muted hover:text-foreground"
        onClick={() => {
          void fetch(`/api/messages/${thread.publicRef}/leave`, { method: "POST" }).then(() =>
            router.push("/messages"),
          );
        }}
      >
        Leave and purge vanish messages
      </button>
    </div>
  );
}
