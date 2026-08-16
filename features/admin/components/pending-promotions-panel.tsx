"use client";

import { ActionButton } from "@/features/promotions/components/promotion-forms";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Queue = {
  campaigns: Array<{ id: string; name: string; status: string; shop: { name: string } }>;
  ads: Array<{ id: string; publicRef: string; status: string; placement: string }>;
  influencers: Array<{ slug: string; displayName: string; verificationStatus: string }>;
  commissions: Array<{ id: string; publicRef: string; status: string; amountCents: number }>;
};

export function PendingPromotionsPanel({ queue }: { queue: Queue }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardTitle>Affiliate campaigns</CardTitle>
        <CardDescription>Approve, reject, or suspend seller campaigns.</CardDescription>
        <ul className="mt-3 space-y-3">
          {queue.campaigns.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted">
                  {row.shop.name} · <Badge>{row.status}</Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  url={`/api/admin/promotions/campaigns/${row.id}`}
                  body={{ action: "approve" }}
                  label="Approve"
                />
                <ActionButton
                  url={`/api/admin/promotions/campaigns/${row.id}`}
                  body={{ action: "reject" }}
                  label="Reject"
                />
                <ActionButton
                  url={`/api/admin/promotions/campaigns/${row.id}`}
                  body={{ action: "suspend" }}
                  label="Suspend"
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Sponsored ads</CardTitle>
        <ul className="mt-3 space-y-3">
          {queue.ads.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm">
                {row.publicRef} · {row.placement} · {row.status}
              </p>
              <div className="flex gap-2">
                <ActionButton
                  url={`/api/admin/promotions/ads/${row.id}`}
                  body={{ action: "approve" }}
                  label="Approve"
                />
                <ActionButton
                  url={`/api/admin/promotions/ads/${row.id}`}
                  body={{ action: "suspend" }}
                  label="Suspend"
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Influencer verification</CardTitle>
        <ul className="mt-3 space-y-3">
          {queue.influencers.map((row) => (
            <li key={row.slug} className="flex flex-wrap items-center justify-between gap-2">
              <p>
                {row.displayName} · {row.slug} · {row.verificationStatus}
              </p>
              <div className="flex gap-2">
                <ActionButton
                  url={`/api/admin/promotions/influencers/${row.slug}`}
                  body={{ action: "verify" }}
                  label="Verify"
                />
                <ActionButton
                  url={`/api/admin/promotions/influencers/${row.slug}`}
                  body={{ action: "reject" }}
                  label="Reject"
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
