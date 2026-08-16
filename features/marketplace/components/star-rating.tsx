import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders the seller's real Shop review average (features/shops —
 * ShopReview) as a 5-star row. `ratingAvg: null` (no reviews yet) shows
 * all-outline stars rather than fabricating a number.
 */
export function StarRating({
  ratingAvg,
  reviewCount,
  className,
}: {
  ratingAvg: number | null;
  reviewCount: number;
  className?: string;
}) {
  const rounded = ratingAvg != null ? Math.round(ratingAvg) : 0;
  const label =
    ratingAvg != null
      ? `${ratingAvg.toFixed(1)} out of 5 (${reviewCount} review${reviewCount === 1 ? "" : "s"})`
      : "No reviews yet";

  return (
    <div className={cn("flex items-center gap-0.5", className)} title={label} aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-3 w-3",
            index < rounded ? "fill-neon-lime text-neon-lime" : "text-muted",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}
