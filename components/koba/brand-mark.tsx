import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Omit for the default "/" link, pass `null` to render unlinked. */
  href?: string | null;
  className?: string;
  showWordmark?: boolean;
  size?: number;
};

/**
 * The KOBA wing mark, monochrome (client, 2026-08-17: "the logo needs to
 * use the black and white color scheme, same for the favicon" — part of
 * the platform-wide gradient/brand-orange → black-and-white pivot). The
 * source PNG (public/brand/koba-logo.png) is a solid-color glyph on a
 * transparent background, so it's masked with `currentColor` — the same
 * technique koba-plus-mark.tsx uses — rather than shown as a raw
 * `<Image>`, so it inherits `text-foreground` and repaints automatically
 * with the dark/light toggle instead of staying brand-orange.
 */
export function BrandMark({ href = "/", className, showWordmark = true, size = 32 }: BrandMarkProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <span
        role="img"
        aria-label="KOBA"
        style={{
          // Explicit "px" strings, not bare numbers — React's own
          // unitless-number-to-px conversion for inline styles is where
          // the dev overlay's "32 vs 32px" hydration diff came from.
          width: `${size}px`,
          height: `${size}px`,
          WebkitMaskImage: "url(/brand/koba-logo.png)",
          maskImage: "url(/brand/koba-logo.png)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          background: "currentColor",
          display: "inline-block",
        }}
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
