"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BlockButton({
  handle,
  signedIn,
  isSelf,
  initialBlocked,
}: {
  handle: string;
  signedIn: boolean;
  isSelf: boolean;
  initialBlocked: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);

  if (isSelf) {
    return null;
  }

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/u/${handle}`);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/social/block/${handle}`, { method: "POST" });
    const payload = (await response.json()) as { blocked?: boolean };
    setBusy(false);
    if (response.ok && typeof payload.blocked === "boolean") {
      setBlocked(payload.blocked);
      router.refresh();
    }
  }

  return (
    <Button size="sm" variant={blocked ? "danger" : "ghost"} onClick={() => void toggle()} disabled={busy}>
      {blocked ? "Unblock" : "Block"}
    </Button>
  );
}
