import React, { useId } from "react";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

/**
 * Ornate game-badge medallion — hex gem set in a beveled metal frame,
 * with wings on the two hardest-earned tiers. Client correction
 * (2026-08-17): the first pass reused the flat marketplace rarity crest
 * PNGs as the badge frame; that read as a "rarity label", not a
 * collectible badge. Reference images supplied were mobile-game rank/
 * medal asset packs (gem-in-metal-frame, wings on the top tier, gold
 * rivets) — this is an original SVG built in that genre, tinted to
 * KOBA's own six rarity hues (not a copy of any specific reference
 * asset), rather than a raster import.
 *
 * Pure presentation — no data. `AchievementBadge` layers the lucide icon
 * glyph on top of this.
 */

type TierPalette = {
  metalLight: string;
  metalMid: string;
  metalDark: string;
  gemLight: string;
  gemMid: string;
  gemDark: string;
  wings: boolean;
  sparkle: boolean;
};

const TIER_PALETTE: Record<ProductRarity, TierPalette> = {
  COMMON: {
    metalLight: "#d6d7dc",
    metalMid: "#9a9ca6",
    metalDark: "#54565f",
    gemLight: "#c7c8d1",
    gemMid: "#8b8a9c",
    gemDark: "#4a4a56",
    wings: false,
    sparkle: false,
  },
  UNCOMMON: {
    metalLight: "#c9d9c8",
    metalMid: "#5f9a6f",
    metalDark: "#2c4f34",
    gemLight: "#7ce8a4",
    gemMid: "#1fbf6c",
    gemDark: "#0e6b3c",
    wings: false,
    sparkle: false,
  },
  RARE: {
    metalLight: "#cfe6f2",
    metalMid: "#4ea3c9",
    metalDark: "#255e79",
    gemLight: "#8fe0fb",
    gemMid: "#33c1f0",
    gemDark: "#12678a",
    wings: false,
    sparkle: false,
  },
  EPIC: {
    metalLight: "#e3d0f5",
    metalMid: "#9a5fd6",
    metalDark: "#4f2b78",
    gemLight: "#d59bff",
    gemMid: "#b451f0",
    gemDark: "#6c1fa3",
    wings: false,
    sparkle: false,
  },
  LEGENDARY: {
    metalLight: "#fff0c2",
    metalMid: "#e0a52a",
    metalDark: "#8a5c07",
    gemLight: "#ffe08a",
    gemMid: "#ffb648",
    gemDark: "#b6650a",
    wings: true,
    sparkle: false,
  },
  RELIC: {
    metalLight: "#ffd7d9",
    metalMid: "#e0396a",
    metalDark: "#7a0f30",
    gemLight: "#ff8fa3",
    gemMid: "#ff2469",
    gemDark: "#8f0a35",
    wings: true,
    sparkle: true,
  },
};

// A pointed hexagon ("gem cut") in a 100x100 viewBox — the recurring
// silhouette across every reference image (hex/shield gem set in metal).
const GEM_OUTER = "M50 4 L88 27 L88 73 L50 96 L12 73 L12 27 Z";
const GEM_INNER = "M50 16 L78 32.5 L78 67.5 L50 84 L22 67.5 L22 32.5 Z";

// A single tapering feather blade, repeated in a fan from a shared root
// at the hex's side rivet — reads clearly as a wing at badge scale, unlike
// a single scalloped outline (first pass: too thin, blended into the
// backdrop). Dark outline keeps it legible over both light and dark
// surfaces regardless of the tier's metal tone.
function Feather({ rotate, length }: { rotate: number; length: number }) {
  return (
    <path
      d={`M0 0 C -3 -2.5, -5 -${length * 0.55}, -1.5 -${length} C -0.6 -${length * 0.8}, 0.6 -${length * 0.8}, 1.5 -${length} C 5 -${length * 0.55}, 3 -2.5, 0 0 Z`}
      transform={`rotate(${rotate})`}
      stroke="rgba(0,0,0,0.35)"
      strokeWidth="0.5"
    />
  );
}

function Wing({ side, gradientId }: { side: "left" | "right"; gradientId: string }) {
  const flip = side === "left" ? "scale(-1,1) translate(-100,0)" : undefined;
  // Root sits just outside the hex's left rivet (12,27)/(12,73) midpoint,
  // fanning up and outward — five feathers, longest in the middle.
  return (
    <g transform={flip} fill={`url(#${gradientId})`}>
      <g transform="translate(11,50)">
        <Feather rotate={-52} length={19} />
        <Feather rotate={-34} length={24} />
        <Feather rotate={-14} length={27} />
        <Feather rotate={6} length={24} />
        <Feather rotate={24} length={19} />
      </g>
    </g>
  );
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
  const metalGrad = `metal-${uid}`;
  const gemGrad = `gem-${uid}`;
  const glossGrad = `gloss-${uid}`;
  const wingGrad = `wing-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={metalGrad} x1="15%" y1="10%" x2="85%" y2="95%">
          <stop offset="0%" stopColor={palette.metalLight} />
          <stop offset="55%" stopColor={palette.metalMid} />
          <stop offset="100%" stopColor={palette.metalDark} />
        </linearGradient>
        <radialGradient id={gemGrad} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor={palette.gemLight} />
          <stop offset="55%" stopColor={palette.gemMid} />
          <stop offset="100%" stopColor={palette.gemDark} />
        </radialGradient>
        <linearGradient id={glossGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={wingGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.metalLight} />
          <stop offset="100%" stopColor={palette.metalMid} />
        </linearGradient>
      </defs>

      {palette.wings ? (
        <>
          <Wing side="left" gradientId={wingGrad} />
          <Wing side="right" gradientId={wingGrad} />
        </>
      ) : null}

      {/* Drop shadow */}
      <path d={GEM_OUTER} fill="rgba(0,0,0,0.35)" transform="translate(0,2.5)" />

      {/* Metal bezel */}
      <path d={GEM_OUTER} fill={`url(#${metalGrad})`} stroke={palette.metalDark} strokeWidth="1.2" />

      {/* Gold rivets at the widest points */}
      <circle cx="12" cy="27" r="2.6" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.5" />
      <circle cx="88" cy="27" r="2.6" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.5" />
      <circle cx="12" cy="73" r="2.6" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.5" />
      <circle cx="88" cy="73" r="2.6" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.5" />

      {/* Gem */}
      <path d={GEM_INNER} fill={`url(#${gemGrad})`} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
      {/* Facet lines for a cut-gem read */}
      <path
        d="M50 16 L50 84 M22 32.5 L50 50 L78 32.5 M22 67.5 L50 50 L78 67.5"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.6"
        fill="none"
      />
      {/* Specular highlight */}
      <path d={GEM_INNER} fill={`url(#${glossGrad})`} opacity="0.7" />

      {palette.sparkle ? (
        <>
          <path d="M20 18 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z" fill="#fff3d0" />
          <path d="M80 78 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z" fill="#fff3d0" />
        </>
      ) : null}
    </svg>
  );
}
