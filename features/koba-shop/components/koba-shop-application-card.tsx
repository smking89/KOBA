"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Application = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; note: string | null } | null;

export function KobaShopApplicationCard({ application: initial }: { application: Application }) {
  const [application, setApplication] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/koba-shop/apply", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; application?: Application };
      if (!response.ok || !payload.application) {
        setError(payload.error ?? "Could not submit application.");
        return;
      }
      setApplication(payload.application);
    });
  }

  if (!application || application.status === "REJECTED") {
    return (
      <div className="space-y-2">
        {application?.status === "REJECTED" ? (
          <p className="text-sm text-destructive">
            Previous application rejected{application.note ? `: ${application.note}` : "."} You can
            re-apply.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" onClick={apply} disabled={pending}>
          {pending ? "Submitting…" : "Apply to KOBA Shop"}
        </Button>
      </div>
    );
  }

  return (
    <Badge tone={application.status === "APPROVED" ? "live" : "warning"}>
      {application.status === "APPROVED" ? "Approved to sell" : "Application pending review"}
    </Badge>
  );
}
