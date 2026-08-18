"use client";

import { ActionButton } from "@/features/promotions/components/promotion-forms";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowMain,
  ListRowMeta,
  ListRowTitle,
} from "@/components/dashboard/list-panel";

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
        <div className="mt-3">
          {queue.campaigns.length === 0 ? (
            <ListPanelEmpty>No campaigns waiting for review.</ListPanelEmpty>
          ) : (
            <ListPanel>
              {queue.campaigns.map((row) => (
                <ListRow key={row.id}>
                  <ListRowMain>
                    <ListRowTitle>{row.name}</ListRowTitle>
                    <ListRowMeta>
                      {row.shop.name} · <Badge>{row.status}</Badge>
                    </ListRowMeta>
                  </ListRowMain>
                  <ListRowActions>
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
                  </ListRowActions>
                </ListRow>
              ))}
            </ListPanel>
          )}
        </div>
      </Card>
      <Card>
        <CardTitle>Sponsored ads</CardTitle>
        <div className="mt-3">
          {queue.ads.length === 0 ? (
            <ListPanelEmpty>No sponsored ads waiting for review.</ListPanelEmpty>
          ) : (
            <ListPanel>
              {queue.ads.map((row) => (
                <ListRow key={row.id}>
                  <ListRowMain>
                    <p className="font-mono text-sm text-foreground">
                      {row.publicRef} · {row.placement} · <Badge>{row.status}</Badge>
                    </p>
                  </ListRowMain>
                  <ListRowActions>
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
                  </ListRowActions>
                </ListRow>
              ))}
            </ListPanel>
          )}
        </div>
      </Card>
      <Card>
        <CardTitle>Influencer verification</CardTitle>
        <div className="mt-3">
          {queue.influencers.length === 0 ? (
            <ListPanelEmpty>No influencer profiles waiting for verification.</ListPanelEmpty>
          ) : (
            <ListPanel>
              {queue.influencers.map((row) => (
                <ListRow key={row.slug}>
                  <ListRowMain>
                    <ListRowTitle>{row.displayName}</ListRowTitle>
                    <ListRowMeta>
                      {row.slug} · <Badge>{row.verificationStatus}</Badge>
                    </ListRowMeta>
                  </ListRowMain>
                  <ListRowActions>
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
                  </ListRowActions>
                </ListRow>
              ))}
            </ListPanel>
          )}
        </div>
      </Card>
    </div>
  );
}
