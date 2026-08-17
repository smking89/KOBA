import type { CSSProperties } from "react";

/**
 * The real KOBA Plus mark — client-supplied asset (2026-08-17,
 * public/brand/koba-plus-mark.png), a black silhouette on a transparent
 * background. Rendered via CSS mask-image rather than an <img> so it can
 * be tinted two ways from the exact same source file, with zero drift
 * between them:
 *
 * - `tone="gradient"` (default): KOBA's green→yellow→orange→red brand
 *   spectrum — the real standalone mark (ProfileHero, PlusBadge).
 * - `tone="mono"`: fills with `currentColor` instead, so it can be
 *   dropped into CoinBadge's embossed-engraving treatment and inherit
 *   the coin's own tier tones — genuinely built into the badge art, not
 *   a separately-colored sticker glued on top (client correction,
 *   2026-08-17: "it's supposed to be made to be a part of the actual
 *   badge... the discord badge has the actual discord nitro logo built
 *   into the actual art of the badge").
 *
 * `public/brand/badge-plus.png` (read by KobaBadgeArt/PlusBadge
 * elsewhere) is a flat-gradient PNG baked from this same source — see
 * the badge-gen script — so both call sites always match.
 */
export function KobaPlusMark({
  size = 64,
  className,
  tone = "gradient",
}: {
  size?: number;
  className?: string;
  tone?: "gradient" | "mono";
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    WebkitMaskImage: "url(/brand/koba-plus-mark.png)",
    maskImage: "url(/brand/koba-plus-mark.png)",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    background:
      tone === "gradient"
        ? "linear-gradient(135deg, #6fd23a 0%, #ffd23a 45%, #ff8a1f 72%, #ff3b1f 100%)"
        : "currentColor",
  };

  return <span role="img" aria-label="KOBA Plus" className={className} style={style} />;
}
