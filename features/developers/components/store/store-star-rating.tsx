import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Real rating display for the app store (DevProduct.ratingSum /
 * ratingCount). `rating: null` (no reviews yet) shows "No ratings yet"
 * rather than a fabricated number or empty stars implying a 0 score.
 */
export function StoreStarRating({
  rating,
  ratingCount,
  size = 14,
  showCount = true,
  className,
}: {
  rating: number | null;
  ratingCount: number;
  size?: number;
  showCount?: boolean;
  className?: string;
}) {
  if (rating == null) {
    return <span className={cn("text-xs text-[var(--store-ink-faint)]", className)}>No ratings yet</span>;
  }

  const rounded = Math.round(rating);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="text-sm font-semibold tabular-nums">{rating.toFixed(1)}</span>
      <span className="flex items-center" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={i < rounded ? "fill-[var(--store-star)] text-[var(--store-star)]" : "text-[var(--store-border)]"}
          />
        ))}
      </span>
      {showCount ? (
        <span className="text-xs text-[var(--store-ink-faint)] tabular-nums">
          ({ratingCount.toLocaleString()})
        </span>
      ) : null}
    </span>
  );
}
