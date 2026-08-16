import { Badge } from "@/components/ui/badge";

export function ReferralBanner({ handle, productTitle }: { handle: string; productTitle: string }) {
  return (
    <div className="rounded-md border border-neon-mint/40 bg-surface-2 px-3 py-2 text-sm">
      <Badge tone="live">Referral</Badge>
      <p className="mt-1">
        Referred by <span className="font-mono text-neon-mint">@{handle}</span> for {productTitle}.
        Checkout applies this shop’s influencer terms if they are enabled.
      </p>
    </div>
  );
}
