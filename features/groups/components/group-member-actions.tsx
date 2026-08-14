"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GroupMemberActions({
  slug,
  kobaId,
  role,
  viewerRole,
}: {
  slug: string;
  kobaId: string | null;
  role: string;
  viewerRole: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!kobaId || role === "OWNER" || viewerRole === "MEMBER" || !viewerRole) {
    return null;
  }
  if (viewerRole === "MODERATOR" && (role === "ADMIN" || role === "MODERATOR")) {
    return null;
  }

  async function run(action: string, nextRole?: string) {
    setBusy(true);
    await fetch(`/api/groups/${slug}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, kobaId, role: nextRole }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1">
      {viewerRole === "OWNER" || viewerRole === "ADMIN" ? (
        <>
          {role !== "ADMIN" && viewerRole === "OWNER" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run("set_role", "ADMIN")}
            >
              Admin
            </Button>
          ) : null}
          {role !== "MODERATOR" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run("set_role", "MODERATOR")}
            >
              Mod
            </Button>
          ) : null}
          {role !== "MEMBER" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run("set_role", "MEMBER")}
            >
              Member
            </Button>
          ) : null}
        </>
      ) : null}
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run("kick")}>
        Kick
      </Button>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => void run("ban")}>
        Ban
      </Button>
    </div>
  );
}
