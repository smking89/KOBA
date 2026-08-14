"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LfgJoinButton({
  publicRef,
  signedIn,
  isAuthor,
  status,
  viewerRequest,
}: {
  publicRef: string;
  signedIn: boolean;
  isAuthor: boolean;
  status: string;
  viewerRequest: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthor) {
    return <p className="text-sm text-muted">You posted this party.</p>;
  }
  if (status !== "OPEN") {
    return null;
  }
  if (viewerRequest === "PENDING") {
    return <Button disabled>Request pending</Button>;
  }
  if (viewerRequest === "ACCEPTED") {
    return <Button disabled>Seat reserved</Button>;
  }
  if (viewerRequest === "DECLINED") {
    return <p className="text-sm text-muted">Request declined.</p>;
  }

  async function request() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/lfg/${publicRef}`);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/lfg/${publicRef}/join`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not request a seat.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void request()} disabled={busy}>
        {busy ? "Sending…" : "Request to join"}
      </Button>
    </div>
  );
}
