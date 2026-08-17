import React from "react";

/**
 * The real KOBA Plus mark — a jagged shard/star with a plus sign overlaid
 * at the lower-right. `public/brand/badge-plus.png` (read by
 * KobaBadgeArt/PlusBadge elsewhere in the app) currently contains an
 * unrelated crossed-swords image — a real asset mixup, not this mark —
 * fixed by regenerating that PNG from this component (see the badge-gen
 * script) rather than by editing KobaBadgeArt's call sites.
 *
 * Recreated from a reference image pasted directly in chat (2026-08-17) —
 * not extracted pixel-for-pixel, since a pasted chat image isn't a file
 * this tool has access to. Swap in the exact source asset if pixel
 * fidelity matters (same flow as the rarity badge PNGs: save it under
 * public/brand/ and point KobaBadgeArt/this component at the real file).
 *
 * `tone="gradient"` (default) is the real brand mark — KOBA's
 * green→yellow→orange→red spectrum, used standalone (ProfileHero,
 * PlusBadge). `tone="mono"` fills with `currentColor` instead, so it can
 * be dropped into the CoinBadge's embossed-engraving treatment and
 * inherit the coin's own tier tones — genuinely built into the badge
 * art, not a separate-colored sticker glued on top (client correction,
 * 2026-08-17: "it's supposed to be made to be a part of the actual
 * badge... the discord badge has the actual discord nitro logo built
 * into the actual art of the badge").
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
  const fill = tone === "mono" ? "currentColor" : "url(#koba-plus-grad)";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="KOBA Plus"
    >
      {tone === "gradient" ? (
        <defs>
          <linearGradient id="koba-plus-grad" x1="10%" y1="0%" x2="95%" y2="100%">
            <stop offset="0%" stopColor="#6fd23a" />
            <stop offset="45%" stopColor="#ffd23a" />
            <stop offset="72%" stopColor="#ff8a1f" />
            <stop offset="100%" stopColor="#ff3b1f" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M32 6 L52 34 L44 40 L58 46 L86 4 L64 52 L52 74 L58 50 L40 58 L14 82 L34 46 Z"
        fill="none"
        stroke={fill}
        strokeWidth="5.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M64 54 a9 9 0 0 1 18 0 v10 h10 a9 9 0 0 1 0 18 h-10 v10 a9 9 0 0 1 -18 0 v-10 h-10 a9 9 0 0 1 0 -18 h10 Z"
        fill={fill}
      />
    </svg>
  );
}
