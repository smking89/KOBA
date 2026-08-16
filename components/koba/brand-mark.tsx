import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  showWordmark?: boolean;
};

export function BrandMark({ href = "/", className, showWordmark = true }: BrandMarkProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/brand/koba-logo.png"
        alt="KOBA"
        width={32}
        height={32}
        priority
        className="h-8 w-8 object-contain"
        // Dark Reader (and similar browser extensions) injects a
        // --darkreader-inline-color style attribute on this element
        // before React hydrates, which triggers a false-positive
        // hydration mismatch warning — not an app bug. This is React's
        // own documented mitigation for extension-modified DOM nodes.
        suppressHydrationWarning
      />
      {showWordmark ? (
        <span className="font-sans text-lg font-bold tracking-[0.08em] text-foreground">KOBA</span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </Link>
    );
  }

  return content;
}
