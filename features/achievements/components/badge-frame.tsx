import React, { useId } from "react";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

/**
 * Original KOBA coin badge — a circular medallion with a clean beveled
 * rim, a glossy gradient face, and a recessed inset panel where the
 * glyph sits. Tinted to KOBA's own six rarity hues. Rarity tier reads
 * through richness: Common/Uncommon are a plain coin; Rare+ add gold
 * rivets; Legendary/Relic add emanating rays and (Relic only) sparkle
 * glints.
 *
 * Client direction, 2026-08-17: reference is Discord's own real badges
 * (the simple, clean, single-glyph style) — a busier first pass (a
 * milled tick-mark edge borrowed from a fan-made tiered badge pack) read
 * as noisy, not premium; simplified here. The inset panel exists
 * specifically so an embossed glyph — especially the KOBA Plus mark —
 * sits in its own defined recess instead of floating flat on the coin's
 * face ("not just the KOBA Plus logo slapped on top of a flat badge").
 * This is original artwork in the general "tiered medallion" genre, not
 * a reuse of any specific reference asset's shapes or files.
 *
 * Pure presentation — no data. AchievementBadge layers the numeral,
 * lucide icon, or KOBA Plus mark on top of this, using an embossed
 * (engraved-in) treatment sharing this coin's own tones.
 */

type TierPalette = {
  faceLight: string;
  faceMid: string;
  faceDark: string;
  edgeLight: string;
  edgeDark: string;
  rays: boolean;
  sparkle: boolean;
};

// Grayscale value ramp (client, 2026-08-17: "let's forget the gradients,
// and use black and white color scheme") — same escalating-lightness
// logic as app/globals.css's --color-rarity-* tokens (common closest to
// mid-gray/least distinct, relic at maximum brightness/most distinct),
// applied to the coin's own light/mid/dark facets instead of a single
// flat value so the medallion keeps its beveled, embossed depth.
const TIER_PALETTE: Record<ProductRarity, TierPalette> = {
  COMMON: {
    faceLight: "#d4d4d8",
    faceMid: "#a8a8b0",
    faceDark: "#5c5c62",
    edgeLight: "#9a9aa2",
    edgeDark: "#3a3a40",
    rays: false,
    sparkle: false,
  },
  UNCOMMON: {
    faceLight: "#e0e0e4",
    faceMid: "#b8b8be",
    faceDark: "#6a6a70",
    edgeLight: "#a8a8b0",
    edgeDark: "#444448",
    rays: false,
    sparkle: false,
  },
  RARE: {
    faceLight: "#ececee",
    faceMid: "#c8c8cc",
    faceDark: "#7a7a80",
    edgeLight: "#b8b8be",
    edgeDark: "#4e4e54",
    rays: false,
    sparkle: false,
  },
  EPIC: {
    faceLight: "#f2f2f4",
    faceMid: "#d8d8dc",
    faceDark: "#8c8c92",
    edgeLight: "#c8c8cc",
    edgeDark: "#58585e",
    rays: false,
    sparkle: false,
  },
  LEGENDARY: {
    faceLight: "#f8f8f9",
    faceMid: "#e8e8ea",
    faceDark: "#a0a0a6",
    edgeLight: "#d8d8dc",
    edgeDark: "#64646a",
    rays: true,
    sparkle: false,
  },
  RELIC: {
    faceLight: "#ffffff",
    faceMid: "#f0f0f2",
    faceDark: "#b4b4ba",
    edgeLight: "#e8e8ea",
    edgeDark: "#70707a",
    rays: true,
    sparkle: true,
  },
};

/** Returns the coin's own dark/light tones — used by AchievementBadge to
 * emboss a glyph in matching colors instead of an unrelated fixed color. */
export function coinTones(rarity: ProductRarity): { dark: string; light: string } {
  const p = TIER_PALETTE[rarity];
  return { dark: p.faceDark, light: p.faceLight };
}

function Rays({ color }: { color: string }) {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * 360;
    return (
      <rect
        key={i}
        x="49.2"
        y="-4"
        width="1.6"
        height="12"
        rx="0.8"
        fill={color}
        opacity="0.3"
        transform={`rotate(${angle} 50 50)`}
      />
    );
  });
  return <g>{rays}</g>;
}

export function BadgeFrame({
  rarity,
  size = 96,
  className,
}: {
  rarity: ProductRarity;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const palette = TIER_PALETTE[rarity];
  const faceGrad = `face-${uid}`;
  const edgeGrad = `edge-${uid}`;
  const glossGrad = `gloss-${uid}`;
  const insetGrad = `inset-${uid}`;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={edgeGrad} x1="20%" y1="10%" x2="80%" y2="90%">
          <stop offset="0%" stopColor={palette.edgeLight} />
          <stop offset="100%" stopColor={palette.edgeDark} />
        </linearGradient>
        <radialGradient id={faceGrad} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor={palette.faceLight} />
          <stop offset="55%" stopColor={palette.faceMid} />
          <stop offset="100%" stopColor={palette.faceDark} />
        </radialGradient>
        <linearGradient id={glossGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Recessed emblem panel — a soft inner-shadow ring so the glyph
            sits in its own sunken disc rather than floating on the flat
            face. This is what makes an embossed logo read as "engraved
            in" instead of "pasted on top". */}
        <radialGradient id={insetGrad} cx="50%" cy="46%" r="58%">
          <stop offset="0%" stopColor={palette.faceDark} stopOpacity="0" />
          <stop offset="72%" stopColor={palette.faceDark} stopOpacity="0" />
          <stop offset="92%" stopColor={palette.faceDark} stopOpacity="0.4" />
          <stop offset="100%" stopColor={palette.faceDark} stopOpacity="0.05" />
        </radialGradient>
      </defs>

      {palette.rays ? <Rays color={palette.edgeLight} /> : null}

      {/* Drop shadow */}
      <circle cx="50" cy="51.5" r="45" fill="rgba(0,0,0,0.35)" />

      {/* Clean bevel rim — no busy tick pattern */}
      <circle cx="50" cy="50" r="45" fill={`url(#${edgeGrad})`} />
      <circle cx="50" cy="50" r="41.5" fill="none" stroke={palette.edgeDark} strokeWidth="0.6" opacity="0.5" />

      {/* Face */}
      <circle cx="50" cy="50" r="38" fill={`url(#${faceGrad})`} stroke="rgba(0,0,0,0.22)" strokeWidth="1" />

      {/* Recessed inset panel behind the glyph */}
      <circle cx="50" cy="50" r="30" fill={`url(#${insetGrad})`} />
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="0.8" />

      <circle cx="50" cy="50" r="38" fill={`url(#${glossGrad})`} opacity="0.55" />

      {rarity === "RARE" || rarity === "EPIC" || rarity === "LEGENDARY" || rarity === "RELIC" ? (
        <>
          <circle cx="50" cy="9.5" r="2.2" fill="#e8e8ec" stroke="#5a5a60" strokeWidth="0.4" />
          <circle cx="50" cy="90.5" r="2.2" fill="#e8e8ec" stroke="#5a5a60" strokeWidth="0.4" />
        </>
      ) : null}

      {palette.sparkle ? (
        <>
          <path d="M18 20 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill="#ffffff" />
          <path d="M82 78 l0.9 2.2 2.2 0.9 -2.2 0.9 -0.9 2.2 -0.9 -2.2 -2.2 -0.9 2.2 -0.9 Z" fill="#ffffff" />
        </>
      ) : null}
    </svg>
  );
}
