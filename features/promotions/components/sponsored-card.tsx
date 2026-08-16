"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SponsoredPlacementCard({
  campaignId,
  href,
  title,
  subtitle,
}: {
  campaignId: string;
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="border-neon-lime/20">
      <CardHeader>
        <Badge tone="live" dot>
          Sponsored
        </Badge>
      </CardHeader>
      <CardTitle className="mt-3">
        <Link
          href={href}
          className="hover:text-neon-lime"
          onClick={() => {
            void fetch("/api/ads/click", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ campaignId }),
            });
          }}
        >
          {title}
        </Link>
      </CardTitle>
      <CardDescription>{subtitle}</CardDescription>
    </Card>
  );
}
