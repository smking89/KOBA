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
  size = "h-3 w-3",
  variant = "default",
}: {
  ratingAvg: number | null;
  reviewCount: number;
  className?: string;
  size?: string;
  /** "card" is the TCG-style product card's brand-orange outline
   * treatment (client reference, 2026-08-17) instead of the default lime. */
  variant?: "default" | "card";
}) {
  const rounded = ratingAvg != null ? Math.round(ratingAvg) : 0;
  const label =
    ratingAvg != null
      ? `${ratingAvg.toFixed(1)} out of 5 (${reviewCount} review${reviewCount === 1 ? "" : "s"})`
      : "No reviews yet";
  const filledClass = variant === "card" ? "fill-neon-lime text-neon-lime" : "fill-neon-lime text-neon-lime";
  const emptyClass = variant === "card" ? "text-neon-lime" : "text-muted";

  return (
    <div className={cn("flex items-center gap-0.5", className)} title={label} aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(size, index < rounded ? filledClass : emptyClass)}
          aria-hidden
        />
      ))}
    </div>
  );
}
