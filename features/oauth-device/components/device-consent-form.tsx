"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SCOPE_LABEL: Record<string, string> = {
  "inventory:read": "See which skins/cosmetics you own",
  "inventory:write": "Report back which skins it applied",
};

export function DeviceConsentForm({
  userCode,
  clientLabel,
  scopes,
}: {
  userCode: string;
  clientLabel: string;
  scopes: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [result, setResult] = useState<"approved" | "denied" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "approve" | "deny") {
    setPending(action);
    setError(null);
    const response = await fetch(`/api/oauth/device/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode }),
    });
    setPending(null);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Something went wrong.");
      return;
    }
    setResult(action === "approve" ? "approved" : "denied");
    router.refresh();
  }

  if (result === "approved") {
    return (
      <p className="text-center text-sm text-muted">
        Approved. Go back to {clientLabel} — it will finish signing in automatically.
      </p>
    );
  }
  if (result === "denied") {
    return <p className="text-center text-sm text-muted">Denied. You can close this tab.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-white/10 bg-white/5 p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">Code</p>
        <p className="mt-1 font-mono text-2xl tracking-widest">{userCode}</p>
      </div>
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">{clientLabel}</span> wants to:
      </p>
      <ul className="space-y-1 text-sm text-muted">
        {scopes.map((scope) => (
          <li key={scope} className="flex items-start gap-2">
            <span aria-hidden>·</span>
            {SCOPE_LABEL[scope] ?? scope}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" className="flex-1" disabled={pending !== null} onClick={() => respond("approve")}>
          {pending === "approve" ? "Approving…" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={pending !== null}
          onClick={() => respond("deny")}
        >
          {pending === "deny" ? "Denying…" : "Deny"}
        </Button>
      </div>
    </div>
  );
}
