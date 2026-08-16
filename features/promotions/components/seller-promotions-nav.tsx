import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const LINKS = [
  { href: "/seller/promotions", label: "Campaigns" },
  { href: "/seller/promotions/new", label: "New campaign" },
  { href: "/seller/promo-codes", label: "Promo codes" },
  { href: "/seller/influencers", label: "Influencers" },
  { href: "/seller/ads", label: "Sponsored ads" },
] as const;

export function SellerPromotionsNav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Seller promotions">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            buttonVariants({
              variant: current === link.href ? "primary" : "secondary",
              size: "sm",
            }),
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
