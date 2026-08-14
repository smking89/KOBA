"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MessageButton({
  handle,
  signedIn,
  isSelf,
  blocked,
}: {
  handle: string;
  signedIn: boolean;
  isSelf: boolean;
  blocked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isSelf || blocked) {
    return null;
  }

  async function open() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/u/${handle}`);
      return;
    }
    setBusy(true);
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const payload = (await response.json()) as { publicRef?: string };
    setBusy(false);
    if (response.ok && payload.publicRef) {
      router.push(`/messages/${payload.publicRef}`);
    }
  }

  return (
    <Button variant="secondary" onClick={() => void open()} disabled={busy}>
      Message
    </Button>
  );
}
