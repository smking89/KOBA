import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const LINKS = [
  { href: "/influencer", label: "Overview" },
  { href: "/influencer/profile", label: "Profile" },
  { href: "/influencer/campaigns", label: "Campaigns" },
  { href: "/influencer/referrals", label: "Referrals" },
  { href: "/influencer/commissions", label: "Commissions" },
  { href: "/influencer/analytics", label: "Analytics" },
] as const;

export function InfluencerPromotionsNav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Influencer promotions">
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
