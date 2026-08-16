import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AidenProduct } from "@/features/aiden/providers/types";

const PRODUCT_LOGO: Record<AidenProduct, string> = {
  VEST: "/brand/aiden/vest-logo.png",
  GRAFT: "/brand/aiden/graft-logo.png",
  TERRA: "/brand/aiden/terra-logo.png",
};

/** Aiden's own icon — used as the route-scoped favicon for everything
 * under /aiden (see app/(app)/aiden/icon.png) and here as the in-page mark.
 * Only applies within Aiden pages, matching "icon only on aiden.koba.games"
 * as closely as the current single-app architecture allows (see
 * ROADMAP.md Phase 20 for the real subdomain split). */
export function AidenBrandMark({
  href = "/aiden",
  className,
  showWordmark = true,
}: {
  href?: string;
  className?: string;
  showWordmark?: boolean;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/brand/aiden/aiden-icon.png"
        alt="Aiden"
        width={28}
        height={28}
        priority
        className="h-7 w-7 object-contain"
        // See components/koba/brand-mark.tsx — same Dark Reader
        // false-positive hydration warning mitigation.
        suppressHydrationWarning
      />
      {showWordmark ? (
        <span className="font-sans text-lg font-bold tracking-[0.08em] text-foreground">AIDEN</span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="rounded-md focus-visible:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}

/** The Vest/Graft/Terra wordmark for a given product, each already
 * composited with the Aiden icon by the designer (see the source PNGs). */
export function AidenProductLogo({
  product,
  className,
}: {
  product: AidenProduct;
  className?: string;
}) {
  return (
    <Image
      src={PRODUCT_LOGO[product]}
      alt={product}
      width={200}
      height={110}
      className={cn("h-auto w-full max-w-[200px] object-contain", className)}
      suppressHydrationWarning
    />
  );
}
