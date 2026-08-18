"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type PendingApplication = {
  id: string;
  shop: { id: string; name: string; slug: string; verificationStatus: string };
};

export function PendingKobaShopApplicationsPanel({
  applications,
}: {
  applications: PendingApplication[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(applicationId: string, decision: "APPROVED" | "REJECTED") {
    setError(null);
    const response = await fetch(`/api/admin/koba-shop/applications/${applicationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not review application.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (applications.length === 0) {
    return <p className="text-sm text-muted">No KOBA Shop applications waiting for review.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {applications.map((application) => (
          <li
            key={application.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-foreground">{application.shop.name}</p>
              <p className="text-xs text-muted">
                Blue-Badge: {application.shop.verificationStatus}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={pending} onClick={() => void act(application.id, "APPROVED")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => void act(application.id, "REJECTED")}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
