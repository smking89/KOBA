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

const TIER_PALETTE: Record<ProductRarity, TierPalette> = {
  COMMON: {
    faceLight: "#c7c8d1",
    faceMid: "#9a9ca6",
    faceDark: "#54565f",
    edgeLight: "#8b8a9c",
    edgeDark: "#3d3e46",
    rays: false,
    sparkle: false,
  },
  UNCOMMON: {
    faceLight: "#7ce8a4",
    faceMid: "#2fa568",
    faceDark: "#0e6b3c",
    edgeLight: "#1fbf6c",
    edgeDark: "#0a4a29",
    rays: false,
    sparkle: false,
  },
  RARE: {
    faceLight: "#8fe0fb",
    faceMid: "#2a9dc4",
    faceDark: "#12678a",
    edgeLight: "#33c1f0",
    edgeDark: "#0c4a63",
    rays: false,
    sparkle: false,
  },
  EPIC: {
    faceLight: "#d59bff",
    faceMid: "#9245c9",
    faceDark: "#6c1fa3",
    edgeLight: "#b451f0",
    edgeDark: "#3f1266",
    rays: false,
    sparkle: false,
  },
  LEGENDARY: {
    faceLight: "#ffe08a",
    faceMid: "#e0952a",
    faceDark: "#b6650a",
    edgeLight: "#ffb648",
    edgeDark: "#6b3a04",
    rays: true,
    sparkle: false,
  },
  RELIC: {
    faceLight: "#ff8fa3",
    faceMid: "#d61f4f",
    faceDark: "#8f0a35",
    edgeLight: "#ff2469",
    edgeDark: "#560720",
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
          <circle cx="50" cy="9.5" r="2.2" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.4" />
          <circle cx="50" cy="90.5" r="2.2" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.4" />
        </>
      ) : null}

      {palette.sparkle ? (
        <>
          <path d="M18 20 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill="#fff3d0" />
          <path d="M82 78 l0.9 2.2 2.2 0.9 -2.2 0.9 -0.9 2.2 -0.9 -2.2 -2.2 -0.9 2.2 -0.9 Z" fill="#fff3d0" />
        </>
      ) : null}
    </svg>
  );
}
