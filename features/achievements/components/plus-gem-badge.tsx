import React, { useId } from "react";
import { KobaPlusMark } from "@/components/koba/koba-plus-mark";

/**
 * KOBA Plus tenure badge — traced directly from the client's own 6
 * hand-drawn outline sketches (~/Desktop/badge examples outlines/,
 * 2026-08-17: Bronze/Silver/Gold/Emerald/Diamond/Ruby), rendered as
 * shaded, colored gem art instead of flat black outlines. Every tier
 * shares one gem-cut shield silhouette (apex, faceted shoulders, a
 * rounded taper to the bottom point); what changes per tier is the
 * accessory built onto that shield, exactly as drawn:
 *
 *  - Bronze:   shield alone, nothing added.
 *  - Silver:   a small arc nested INSIDE the shield, just above the tip.
 *  - Gold:     the shield is cut short and a rounded teardrop gem hangs
 *              below it, plain (no tail).
 *  - Diamond:  the full-length shield gains a 6-petal fan (3 per side)
 *              flaring from the shoulders, plus the same plain teardrop
 *              hanging below the tip.
 *  - Emerald:  everything Diamond has, PLUS a marquise gem above the
 *              apex, an arched double band connecting the shoulders over
 *              the top, and a round gem stud at each shoulder — and the
 *              teardrop grows a segmented chevron tail below it.
 *  - Ruby:     identical to Emerald's marquise/arch/studs/petals, but
 *              the teardrop stays plain like Diamond's (no chevron tail)
 *              — exactly what the client drew.
 *
 * Platinum and Opal weren't in the client's 6 examples (they gave 6 of
 * KOBA's 8 real Plus tiers). Extrapolated in the same escalating
 * language rather than left generic: Platinum carries Silver's internal
 * arc AND Gold's teardrop together (a real step up from Gold, a real
 * step down from Diamond's petals). Opal reuses Emerald's full
 * ornament set (the client's most elaborate drawing) in the original
 * KOBA Plus rainbow spectrum, as the top tier above Ruby.
 */

export type PlusGemTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "emerald"
  | "ruby"
  | "opal";

type Accessory = "none" | "arc" | "teardrop" | "arc-teardrop" | "petals-teardrop" | "full" | "full-tail";

type GemPalette = {
  edgeLight: string;
  edgeDark: string;
  gemLight: string;
  gemMid: string;
  gemDark: string;
  accessory: Accessory;
  glow: boolean;
  rainbow: boolean;
};

const TIER_PALETTE: Record<PlusGemTier, GemPalette> = {
  bronze: {
    edgeLight: "#e8b088",
    edgeDark: "#6b3f1d",
    gemLight: "#f0c9a6",
    gemMid: "#b87333",
    gemDark: "#5c3315",
    accessory: "none",
    glow: false,
    rainbow: false,
  },
  silver: {
    edgeLight: "#f4f4f6",
    edgeDark: "#6b6f78",
    gemLight: "#eef0f3",
    gemMid: "#b8bcc4",
    gemDark: "#585b62",
    accessory: "arc",
    glow: false,
    rainbow: false,
  },
  gold: {
    edgeLight: "#ffe9a8",
    edgeDark: "#8a5c07",
    gemLight: "#fff2c2",
    gemMid: "#e0a52a",
    gemDark: "#7a5106",
    accessory: "teardrop",
    glow: false,
    rainbow: false,
  },
  platinum: {
    edgeLight: "#f7f8fc",
    edgeDark: "#7d8190",
    gemLight: "#eef1fa",
    gemMid: "#c9ccd6",
    gemDark: "#5d616e",
    accessory: "arc-teardrop",
    glow: false,
    rainbow: false,
  },
  diamond: {
    edgeLight: "#eafcff",
    edgeDark: "#12678a",
    gemLight: "#eafcff",
    gemMid: "#8fe0fb",
    gemDark: "#0e5877",
    accessory: "petals-teardrop",
    glow: false,
    rainbow: false,
  },
  emerald: {
    edgeLight: "#a8f5c6",
    edgeDark: "#0a4a29",
    gemLight: "#c8ffe0",
    gemMid: "#1fbf6c",
    gemDark: "#0a4a29",
    accessory: "full-tail",
    glow: true,
    rainbow: false,
  },
  ruby: {
    edgeLight: "#ffb3c2",
    edgeDark: "#7a0f30",
    gemLight: "#ffd6dd",
    gemMid: "#e0396a",
    gemDark: "#6b0d2b",
    accessory: "full",
    glow: true,
    rainbow: false,
  },
  opal: {
    edgeLight: "#fff3d0",
    edgeDark: "#5c3d7a",
    gemLight: "#fff9ea",
    gemMid: "#ffb648",
    gemDark: "#5c3d7a",
    accessory: "full-tail",
    glow: true,
    rainbow: true,
  },
};

// Shared shield silhouette (viewBox 0 0 100 220), traced from the
// client's own outline sketches — apex, two roof facets down to
// shoulder corners, then a smooth rounded taper to the bottom point.
const APEX = { x: 50, y: 40 };
const SHOULDER_L = { x: 15, y: 72 };
const SHOULDER_R = { x: 85, y: 72 };
const TIP_TALL = { x: 50, y: 168 };
const TIP_SHORT = { x: 50, y: 140 };

function shieldPath(tip: { x: number; y: number }, inset = 0) {
  const a = { x: APEX.x, y: APEX.y + inset };
  const sl = { x: SHOULDER_L.x + inset * 1.4, y: SHOULDER_L.y + inset * 0.4 };
  const sr = { x: SHOULDER_R.x - inset * 1.4, y: SHOULDER_R.y + inset * 0.4 };
  const t = { x: tip.x, y: tip.y - inset * 2.2 };
  return `M${a.x},${a.y} L${sr.x},${sr.y} C${sr.x + 5},${sr.y + 42} ${sr.x - 6},${t.y - 46} ${t.x},${t.y} C${sl.x + 6},${t.y - 46} ${sl.x - 5},${sr.y + 42} ${sl.x},${sl.y} Z`;
}

function Petal({ x, y, rotate }: { x: number; y: number; rotate: number }) {
  return (
    <path
      d="M0,4 C-14,-14 -14,-38 0,-56 C14,-38 14,-14 0,4 Z"
      transform={`translate(${x},${y}) rotate(${rotate})`}
    />
  );
}

export function PlusGemBadge({
  tier,
  size = 96,
  className,
}: {
  tier: PlusGemTier;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const palette = TIER_PALETTE[tier];
  const edgeGrad = `pg-edge-${uid}`;
  const gemGrad = `pg-gem-${uid}`;
  const glossGrad = `pg-gloss-${uid}`;
  const rainbowGrad = `pg-rainbow-${uid}`;

  const gemFill = palette.rainbow ? `url(#${rainbowGrad})` : `url(#${gemGrad})`;
  const edgeFill = palette.rainbow ? `url(#${rainbowGrad})` : `url(#${edgeGrad})`;

  const short = palette.accessory === "teardrop" || palette.accessory === "arc-teardrop";
  const tip = short ? TIP_SHORT : TIP_TALL;
  const hasPetalsOrFull = palette.accessory === "petals-teardrop" || palette.accessory === "full" || palette.accessory === "full-tail";
  const hasFullCrown = palette.accessory === "full" || palette.accessory === "full-tail";
  const hasTail = palette.accessory === "full-tail";
  const hasTeardrop = short || hasPetalsOrFull;
  const hasArc = palette.accessory === "arc" || palette.accessory === "arc-teardrop";

  const teardropTop = { x: tip.x, y: tip.y - 6 };
  const teardropBottom = teardropTop.y + 54;

  return (
    <svg
      viewBox="0 0 100 220"
      width={size}
      height={(size * 220) / 100}
      className={className}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={edgeGrad} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={palette.edgeLight} />
          <stop offset="100%" stopColor={palette.edgeDark} />
        </linearGradient>
        <radialGradient id={gemGrad} cx="42%" cy="20%" r="85%">
          <stop offset="0%" stopColor={palette.gemLight} />
          <stop offset="50%" stopColor={palette.gemMid} />
          <stop offset="100%" stopColor={palette.gemDark} />
        </radialGradient>
        <linearGradient id={rainbowGrad} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#7ce88a" />
          <stop offset="35%" stopColor="#ffe66a" />
          <stop offset="65%" stopColor="#ff9a4a" />
          <stop offset="100%" stopColor="#ff4d6a" />
        </linearGradient>
        <linearGradient id={glossGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {palette.glow ? (
        <path d={shieldPath(tip)} fill="none" stroke={palette.edgeLight} strokeWidth="6" opacity="0.28" filter="blur(3px)" />
      ) : null}

      {/* Outer bezel */}
      <path d={shieldPath(tip)} fill={edgeFill} stroke={palette.edgeDark} strokeWidth="1" />
      {/* Inner gem body (inset) */}
      <path d={shieldPath(tip, 5)} fill={gemFill} stroke={palette.gemDark} strokeWidth="0.7" />
      <path d={shieldPath(tip, 5)} fill={`url(#${glossGrad})`} opacity="0.7" />

      {/* Top crease + shoulder facet lines */}
      <path
        d={`M${APEX.x},${APEX.y + 5} L${APEX.x},${APEX.y + 30} M${SHOULDER_L.x + 6},${SHOULDER_L.y + 4} L${APEX.x},${APEX.y + 30} L${SHOULDER_R.x - 6},${SHOULDER_R.y + 4}`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.6"
        fill="none"
      />

      {/* Petal fan — Diamond, Ruby, Emerald, Opal — drawn on top of the
          shield (not underneath it) so the full leaf shape is visible,
          not just the tips poking out past the shield's own silhouette. */}
      {hasPetalsOrFull ? (
        <g fill={edgeFill} stroke={palette.edgeDark} strokeWidth="0.6">
          <Petal x={SHOULDER_L.x} y={SHOULDER_L.y} rotate={-100} />
          <Petal x={SHOULDER_L.x} y={SHOULDER_L.y} rotate={-68} />
          <Petal x={SHOULDER_L.x} y={SHOULDER_L.y} rotate={-36} />
          <Petal x={SHOULDER_R.x} y={SHOULDER_R.y} rotate={100} />
          <Petal x={SHOULDER_R.x} y={SHOULDER_R.y} rotate={68} />
          <Petal x={SHOULDER_R.x} y={SHOULDER_R.y} rotate={36} />
        </g>
      ) : null}

      {/* Slim arched double band across the shoulders — Ruby &
          Emerald/Opal only. Two stroked arcs (not a filled dome) so it
          reads as a thin tiara band, not a solid mitre shape. */}
      {hasFullCrown ? (
        <g fill="none" stroke={palette.edgeDark} strokeWidth="1.4">
          <path d={`M${SHOULDER_L.x},${SHOULDER_L.y - 2} Q${APEX.x},${APEX.y - 24} ${SHOULDER_R.x},${SHOULDER_R.y - 2}`} />
          <path d={`M${SHOULDER_L.x + 3},${SHOULDER_L.y - 8} Q${APEX.x},${APEX.y - 17} ${SHOULDER_R.x - 3},${SHOULDER_R.y - 8}`} />
        </g>
      ) : null}

      {/* Marquise gem above the apex — Ruby & Emerald/Opal only. */}
      {hasFullCrown ? (
        <path
          d={`M${APEX.x},${APEX.y - 34} C${APEX.x + 7},${APEX.y - 23} ${APEX.x + 7},${APEX.y - 8} ${APEX.x},${APEX.y + 2} C${APEX.x - 7},${APEX.y - 8} ${APEX.x - 7},${APEX.y - 23} ${APEX.x},${APEX.y - 34} Z`}
          fill={gemFill}
          stroke={palette.gemDark}
          strokeWidth="0.8"
        />
      ) : null}

      {/* Gem studs at the shoulders — Ruby & Emerald/Opal only */}
      {hasFullCrown ? (
        <>
          <circle cx={SHOULDER_L.x} cy={SHOULDER_L.y} r="6" fill={gemFill} stroke={palette.edgeDark} strokeWidth="1" />
          <circle cx={SHOULDER_R.x} cy={SHOULDER_R.y} r="6" fill={gemFill} stroke={palette.edgeDark} strokeWidth="1" />
        </>
      ) : null}

      {/* Silver's small internal arc, nested just above the tip */}
      {hasArc ? (
        <path
          d={`M${tip.x - 11},${tip.y - 14} A12,10 0 0 1 ${tip.x + 11},${tip.y - 14}`}
          fill="none"
          stroke={palette.gemDark}
          strokeWidth="1.6"
          opacity="0.85"
        />
      ) : null}

      {/* Teardrop pendant hanging below the tip — Gold, Platinum, Diamond, Ruby, Emerald, Opal */}
      {hasTeardrop ? (
        <path
          d={`M${teardropTop.x - 15},${teardropTop.y + 8} C${teardropTop.x - 15},${teardropTop.y - 2} ${teardropTop.x - 8},${teardropTop.y - 8} ${teardropTop.x},${teardropTop.y - 8} C${teardropTop.x + 8},${teardropTop.y - 8} ${teardropTop.x + 15},${teardropTop.y - 2} ${teardropTop.x + 15},${teardropTop.y + 8} C${teardropTop.x + 15},${teardropBottom - 18} ${teardropTop.x + 7},${teardropBottom - 4} ${teardropTop.x},${teardropBottom} C${teardropTop.x - 7},${teardropBottom - 4} ${teardropTop.x - 15},${teardropBottom - 18} ${teardropTop.x - 15},${teardropTop.y + 8} Z`}
          fill={gemFill}
          stroke={palette.gemDark}
          strokeWidth="0.8"
        />
      ) : null}

      {/* Segmented chevron tail below the teardrop — Emerald & Opal only */}
      {hasTail ? (
        <g stroke={palette.edgeDark} strokeWidth="1.4" fill="none" opacity="0.85">
          <path d={`M${teardropTop.x - 10},${teardropBottom + 2} L${teardropTop.x},${teardropBottom + 9} L${teardropTop.x + 10},${teardropBottom + 2}`} />
          <path d={`M${teardropTop.x - 9},${teardropBottom + 10} L${teardropTop.x},${teardropBottom + 17} L${teardropTop.x + 9},${teardropBottom + 10}`} />
          <path d={`M${teardropTop.x - 7},${teardropBottom + 18} L${teardropTop.x},${teardropBottom + 24} L${teardropTop.x + 7},${teardropBottom + 18}`} />
        </g>
      ) : null}

      {palette.rainbow ? (
        <>
          <path d="M18,26 l1.4,3.4 3.4,1.4 -3.4,1.4 -1.4,3.4 -1.4,-3.4 -3.4,-1.4 3.4,-1.4 Z" fill="#fff9ea" />
          <path d="M82,32 l1,2.4 2.4,1 -2.4,1 -1,2.4 -1,-2.4 -2.4,-1 2.4,-1 Z" fill="#fff9ea" />
        </>
      ) : null}

      {/* KOBA Plus mark, engraved into the gem (light/dark relief from
          this tier's own tones, same technique as the circular
          achievement coins) — centered in the shield body. */}
      <foreignObject x={APEX.x - 21} y={SHOULDER_L.y - 3} width="42" height="42">
        <div style={{ position: "relative", width: 42, height: 42 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              transform: "translate(-0.6px,-0.6px)",
              color: palette.gemLight,
            }}
          >
            <KobaPlusMark tone="mono" size={40} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", color: palette.gemDark }}>
            <KobaPlusMark tone="mono" size={40} />
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
