"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type InboxItem = {
  publicRef: string;
  vanishMode: boolean;
  peer: { handle: string; name: string; kobaId: string | null };
  lastMessage: {
    kind: string;
    body: string | null;
    createdAt: string;
    fromSelf: boolean;
  } | null;
  unread: number;
  updatedAt: string;
};

export function InboxList({ initial }: { initial: InboxItem[] }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const payload = (await response.json()) as { publicRef?: string; error?: string };
    setBusy(false);
    if (!response.ok || !payload.publicRef) {
      setError(payload.error ?? "Could not open conversation.");
      return;
    }
    router.push(`/messages/${payload.publicRef}`);
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (handle.trim()) {
            void start();
          }
        }}
      >
        <Input
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="Message @handle"
          className="max-w-xs"
        />
        <Button type="submit" disabled={busy || !handle.trim()}>
          {busy ? "Opening…" : "Start chat"}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {initial.length === 0 ? (
          <li className="p-4 text-sm text-muted">No conversations yet.</li>
        ) : (
          initial.map((item) => (
            <li key={item.publicRef}>
              <Link
                href={`/messages/${item.publicRef}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-2"
              >
                <div>
                  <p className="font-semibold">
                    {item.peer.name}{" "}
                    <span className="text-sm font-normal text-muted">@{item.peer.handle}</span>
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-muted">
                    {item.lastMessage?.body ??
                      (item.lastMessage
                        ? `${item.lastMessage.kind.toLowerCase()} message`
                        : "No messages yet")}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  {item.vanishMode ? <p className="text-neon-lime">Vanish</p> : null}
                  {item.unread > 0 ? (
                    <p className="mt-1 font-semibold text-neon-lime">Unread</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
