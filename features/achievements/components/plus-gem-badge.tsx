import React, { useId } from "react";
import { KobaPlusMark } from "@/components/koba/koba-plus-mark";

/**
 * KOBA Plus tenure badge — a faceted gem set in a shield bezel, with the
 * real KOBA Plus mark embossed inside. Built from the client's own hand-
 * drawn outline concepts (2026-08-17, ~/Desktop/badge examples outlines/):
 * a consistent gem-cut shield silhouette across all 8 tenure tiers, with
 * escalating ornamentation — plain (Bronze) → small notch (Silver) →
 * teardrop pendant (Gold, Platinum) → full lotus crown + side studs +
 * pendant (Diamond, Emerald, Ruby, Opal) — colored per tier's real gem
 * material. Platinum and Opal weren't in the client's example set (which
 * covered 6 of KOBA's 8 real Plus tiers); extrapolated here in the same
 * visual language — Platinum between Gold and Diamond in ornamentation,
 * Opal above Ruby with the client's own original rainbow spectrum
 * (matching the first KOBA Plus mark reference they supplied).
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

type GemPalette = {
  edgeLight: string;
  edgeDark: string;
  gemLight: string;
  gemMid: string;
  gemDark: string;
  accessory: "none" | "notch" | "teardrop" | "crown";
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
    accessory: "notch",
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
    accessory: "teardrop",
    glow: false,
    rainbow: false,
  },
  diamond: {
    edgeLight: "#eafcff",
    edgeDark: "#12678a",
    gemLight: "#eafcff",
    gemMid: "#8fe0fb",
    gemDark: "#0e5877",
    accessory: "crown",
    glow: true,
    rainbow: false,
  },
  emerald: {
    edgeLight: "#a8f5c6",
    edgeDark: "#0a4a29",
    gemLight: "#c8ffe0",
    gemMid: "#1fbf6c",
    gemDark: "#0a4a29",
    accessory: "crown",
    glow: true,
    rainbow: false,
  },
  ruby: {
    edgeLight: "#ffb3c2",
    edgeDark: "#7a0f30",
    gemLight: "#ffd6dd",
    gemMid: "#e0396a",
    gemDark: "#6b0d2b",
    accessory: "crown",
    glow: true,
    rainbow: false,
  },
  opal: {
    edgeLight: "#fff3d0",
    edgeDark: "#5c3d7a",
    gemLight: "#fff9ea",
    gemMid: "#ffb648",
    gemDark: "#5c3d7a",
    accessory: "crown",
    glow: true,
    rainbow: true,
  },
};

// Shield/gem silhouette shared by every tier — traced from the client's
// reference outlines. 100x128 viewBox.
const SHIELD_OUTER =
  "M50 4 L84 34 L84 40 L67 40 L50 30 L33 40 L16 40 L16 34 Z " +
  "M16 40 L33 40 C 28 62, 30 92, 50 120 C 70 92, 72 62, 67 40 L84 40 " +
  "C 84 66, 76 100, 50 124 C 24 100, 16 66, 16 40 Z";

const SHIELD_INNER =
  "M50 12 L76 35 L64 38 L50 26 L36 38 L24 35 Z " +
  "M24 35 C 21 60, 26 90, 50 112 C 74 90, 79 60, 76 35 " +
  "C 70 60, 62 88, 50 106 C 38 88, 30 60, 24 35 Z";

function Petal({ rotate }: { rotate: number }) {
  return (
    <path
      d="M0 0 C -6 -10, -6 -22, 0 -30 C 6 -22, 6 -10, 0 0 Z"
      transform={`rotate(${rotate})`}
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

  return (
    <svg viewBox="0 0 100 128" width={size} height={(size * 128) / 100} className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={edgeGrad} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={palette.edgeLight} />
          <stop offset="100%" stopColor={palette.edgeDark} />
        </linearGradient>
        <radialGradient id={gemGrad} cx="42%" cy="22%" r="85%">
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
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {palette.glow ? (
        <path
          d={SHIELD_OUTER}
          fill="none"
          stroke={palette.edgeLight}
          strokeWidth="6"
          opacity="0.28"
          filter="blur(2px)"
        />
      ) : null}

      {/* Crown of petals — Diamond/Emerald/Ruby/Opal only */}
      {palette.accessory === "crown" ? (
        <g fill={`url(#${edgeGrad})`} stroke={palette.edgeDark} strokeWidth="0.6">
          <g transform="translate(24,20)">
            <Petal rotate={-35} />
            <Petal rotate={-10} />
          </g>
          <g transform="translate(76,20)">
            <Petal rotate={35} />
            <Petal rotate={10} />
          </g>
        </g>
      ) : null}

      {/* Side studs — Diamond/Emerald/Ruby/Opal only */}
      {palette.accessory === "crown" ? (
        <>
          <circle cx="16" cy="38" r="6" fill={gemFill} stroke={palette.edgeDark} strokeWidth="1" />
          <circle cx="84" cy="38" r="6" fill={gemFill} stroke={palette.edgeDark} strokeWidth="1" />
        </>
      ) : null}

      {/* Outer bezel */}
      <path d={SHIELD_OUTER} fill={`url(#${edgeGrad})`} stroke={palette.edgeDark} strokeWidth="1" />

      {/* Gem body */}
      <path d={SHIELD_INNER} fill={gemFill} stroke={palette.gemDark} strokeWidth="0.8" />
      <path d={SHIELD_INNER} fill={`url(#${glossGrad})`} opacity="0.7" />

      {/* Bottom accessory */}
      {palette.accessory === "notch" ? (
        <path
          d="M42 108 C 42 116, 46 122, 50 124 C 54 122, 58 116, 58 108 Z"
          fill={`url(#${edgeGrad})`}
          stroke={palette.edgeDark}
          strokeWidth="0.7"
        />
      ) : null}

      {(palette.accessory === "teardrop" || palette.accessory === "crown") ? (
        <>
          <path
            d="M40 106 C 40 118, 45 128, 50 132 C 55 128, 60 118, 60 106 Z"
            fill={gemFill}
            stroke={palette.gemDark}
            strokeWidth="0.8"
          />
          {palette.accessory === "crown" ? (
            <g stroke={palette.edgeDark} strokeWidth="1.4" fill="none" opacity="0.85">
              <path d="M40 132 L50 138 L60 132" />
              <path d="M38 138 L50 145 L62 138" />
            </g>
          ) : null}
        </>
      ) : null}

      {/* Facet highlight lines on the gem body */}
      <path
        d="M50 26 L50 106 M36 38 L50 66 L64 38"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.6"
        fill="none"
      />

      {palette.rainbow ? (
        <>
          <path d="M20 24 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z" fill="#fff9ea" />
          <path d="M80 30 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z" fill="#fff9ea" />
        </>
      ) : null}

      {/* KOBA Plus mark, engraved into the gem (client correction,
          2026-08-17: the mark must read as "built into the actual badge
          art", not a flat sticker) — same two-layer emboss technique as
          the circular achievement coins: a light-tinted copy sits offset
          under a dark-tinted main copy, both drawn from this tier's own
          gem tones. The mask-sized <span> inside KobaPlusMark only
          respects explicit width/height when it's a flex item (a plain
          foreignObject child stays display:inline, where width/height are
          no-ops), so each layer gets its own flex wrapper. */}
      <foreignObject x="29" y="41" width="42" height="42">
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
