import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { StoreAppIcon } from "@/features/developers/components/store/store-app-icon";
import { StoreStarRating } from "@/features/developers/components/store/store-star-rating";
import { categoryLabel } from "@/features/developers/lib/categories";
import type { DevProductCategory } from "@/lib/generated/prisma/client";

export type StoreAppCardData = {
  slug: string;
  name: string;
  shortDescription: string;
  category: DevProductCategory;
  priceLabel: string;
  iconUrl: string | null;
  rating: number | null;
  ratingCount: number;
  kobaOfficial: boolean;
  verifiedPublisher: boolean;
  publisherName: string | null;
};

export function StoreAppCard({ app }: { app: StoreAppCardData }) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-[var(--store-border)] bg-[var(--store-surface)] p-4 shadow-[var(--store-shadow)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <StoreAppIcon name={app.name} iconUrl={app.iconUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--store-ink)]">{app.name}</p>
          <p className="truncate text-xs text-[var(--store-ink-dim)]">
            {app.publisherName ?? "Independent publisher"}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            {app.kobaOfficial ? (
              <span className="rounded-full bg-[var(--store-success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--store-success)]">
                KOBA official
              </span>
            ) : app.verifiedPublisher ? (
              <BadgeCheck
                className="h-4 w-4 shrink-0 fill-[#33c1f0] text-white"
                aria-label="Verified publisher"
              />
            ) : null}
          </div>
        </div>
      </div>

      <p className="line-clamp-2 text-sm text-[var(--store-ink-dim)]">
        {app.shortDescription || categoryLabel(app.category)}
      </p>

      <div className="mt-auto flex items-center justify-between pt-1">
        <StoreStarRating rating={app.rating} ratingCount={app.ratingCount} size={12} />
        <span className="rounded-full bg-[var(--store-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--store-ink)]">
          {app.priceLabel}
        </span>
      </div>
    </Link>
  );
}
