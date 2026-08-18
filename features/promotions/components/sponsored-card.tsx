"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function logClick(campaignId: string) {
  void fetch("/api/ads/click", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campaignId }),
  });
}

export function SponsoredPlacementCard({
  campaignId,
  href,
  title,
  subtitle,
  actionLabel,
}: {
  campaignId: string;
  href: string;
  title: string;
  subtitle: string;
  /** Client, 2026-08-18: "expose the correct action buttons per ad
   * type (e.g., a product ad gets 'Buy'/'View listing,' a group ad
   * gets 'Join,' etc.)" — features/promotions/services/ads.service.ts
   * #resolveSponsoredCreative is the source of truth for this per
   * entityType; optional here only so existing callers keep compiling
   * without passing it. */
  actionLabel?: string;
}) {
  return (
    <Card className="border-neon-lime/20">
      <CardHeader>
        <Badge tone="live" dot>
          Sponsored
        </Badge>
      </CardHeader>
      <CardTitle className="mt-3">
        <Link href={href} className="hover:text-neon-lime" onClick={() => logClick(campaignId)}>
          {title}
        </Link>
      </CardTitle>
      <CardDescription>{subtitle}</CardDescription>
      {actionLabel ? (
        <CardFooter className="justify-start border-none pt-3">
          <Link
            href={href}
            onClick={() => logClick(campaignId)}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {actionLabel}
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}
