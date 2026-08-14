"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GroupJoinButton({
  slug,
  signedIn,
  joined,
  banned,
  pendingRequest,
  pendingInvite,
  isOwner,
  visibility,
}: {
  slug: string;
  signedIn: boolean;
  joined: boolean;
  banned: boolean;
  pendingRequest: boolean;
  pendingInvite: boolean;
  isOwner: boolean;
  visibility: "PUBLIC" | "PRIVATE";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(path: "join" | "leave") {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/groups/${slug}`);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/groups/${slug}/${path}`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not update membership.");
      return;
    }
    router.refresh();
  }

  if (banned) {
    return <p className="text-sm text-destructive">You are banned from this group.</p>;
  }
  if (isOwner) {
    return <BadgeOwner />;
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {joined ? (
        <Button variant="secondary" onClick={() => void run("leave")} disabled={busy}>
          {busy ? "Leaving…" : "Leave group"}
        </Button>
      ) : pendingRequest ? (
        <Button disabled>Request pending</Button>
      ) : (
        <Button onClick={() => void run("join")} disabled={busy}>
          {busy
            ? "Working…"
            : pendingInvite
              ? "Accept invite"
              : visibility === "PRIVATE"
                ? "Request to join"
                : "Join group"}
        </Button>
      )}
    </div>
  );
}

function BadgeOwner() {
  return (
    <p className="text-sm text-muted">
      You own this group. Group Owner is a community role, not KOBA staff.
    </p>
  );
}
