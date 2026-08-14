import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  showWordmark?: boolean;
};

/**
 * Temporary geometric mark until the official KOBA logo asset is added.
 * Shape is intentionally simple and does not claim to be the final logo.
 */
export function BrandMark({ href = "/", className, showWordmark = true }: BrandMarkProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="bg-brand-gradient grid h-8 w-8 place-items-center rounded-md shadow-soft"
      >
        <span className="font-mono text-xs font-bold tracking-wider text-background">K</span>
      </span>
      {showWordmark ? (
        <span className="font-sans text-lg font-bold tracking-[0.08em] text-foreground">KOBA</span>
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
