"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TaggingToggle({
  endpoint,
  initial,
  label,
}: {
  endpoint: string;
  initial: boolean;
  label: string;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: !allowed }),
    });
    const payload = (await response.json()) as { taggingAllowed?: boolean };
    setBusy(false);
    if (response.ok && typeof payload.taggingAllowed === "boolean") {
      setAllowed(payload.taggingAllowed);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Button
        size="sm"
        variant={allowed ? "secondary" : "ghost"}
        onClick={() => void toggle()}
        disabled={busy}
      >
        {allowed ? "Allowed" : "Off"}
      </Button>
    </div>
  );
}
