import { useId } from "react";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

/**
 * Original KOBA coin badge — a circular medallion with a milled edge and
 * a glossy gradient face, tinted to KOBA's own six rarity hues. Rarity
 * tier reads through richness: Common/Uncommon are a plain flat coin;
 * Rare+ add gold rivets; Legendary/Relic add emanating rays behind the
 * coin and (Relic only) sparkle glints.
 *
 * Client correction, 2026-08-17: an earlier pass used mezotv/discord-
 * badges' actual SVG files as the badge art. Even MIT-licensed, shipping
 * Discord's own recognizable badge shapes as KOBA's achievement art
 * reads as "the same exact badges as Discord" — this is original
 * artwork in the same general genre (flat-gradient tiered medallion),
 * not a reuse of any specific reference asset.
 *
 * Pure presentation — no data. AchievementBadge layers the numeral,
 * lucide icon, or KOBA Plus mark on top of this, using an embossed
 * (engraved-in) treatment sharing this coin's own tones — never a
 * separately-colored sticker glued on top.
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

function MilledEdge({ id }: { id: string }) {
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * 360;
    return (
      <line
        key={i}
        x1="50"
        y1="4"
        x2="50"
        y2="8"
        stroke={`url(#${id})`}
        strokeWidth="1.6"
        transform={`rotate(${angle} 50 50)`}
      />
    );
  });
  return <g opacity="0.9">{ticks}</g>;
}

function Rays({ color }: { color: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    return (
      <rect
        key={i}
        x="49"
        y="-6"
        width="2"
        height="16"
        rx="1"
        fill={color}
        opacity="0.35"
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
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {palette.rays ? <Rays color={palette.edgeLight} /> : null}

      {/* Drop shadow */}
      <circle cx="50" cy="51.5" r="45" fill="rgba(0,0,0,0.35)" />

      {/* Milled coin edge */}
      <circle cx="50" cy="50" r="45" fill={`url(#${edgeGrad})`} />
      <MilledEdge id={edgeGrad} />

      {/* Face */}
      <circle cx="50" cy="50" r="37" fill={`url(#${faceGrad})`} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <circle cx="50" cy="50" r="37" fill={`url(#${glossGrad})`} opacity="0.65" />

      {rarity === "RARE" || rarity === "EPIC" || rarity === "LEGENDARY" || rarity === "RELIC" ? (
        <>
          <circle cx="50" cy="9" r="2.4" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.4" />
          <circle cx="50" cy="91" r="2.4" fill="#f4d783" stroke="#8a5c07" strokeWidth="0.4" />
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
