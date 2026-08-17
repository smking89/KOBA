/**
 * KOBA brand tokens — fire red/orange/gold on Discord-like layered
 * charcoal (client rebrand, 2026-08-16). Names kept as-is (neonLime/
 * neonMint) to match app/globals.css's CSS variables of the same name.
 * Prefer these semantic names over raw hex in components.
 */
export const kobaTokens = {
  background: "#0B0C0B",
  surface: "#161916",
  surfaceSecondary: "#1C201E",
  surfaceTertiary: "#232826",
  text: "#F2F7F3",
  textMuted: "#8B958E",
  neonLime: "#FF5A1F",
  electricGreen: "#3BA55D",
  neonMint: "#FFB627",
  border: "rgba(255, 255, 255, 0.06)",
  error: "#ED4245",
  warning: "#FAA81A",
  success: "#3BA55D",
  brandGradient: "linear-gradient(135deg, #F5341E 0%, #FF7A1A 50%, #FFC02E 100%)",
  themeColor: "#FF5A1F",
} as const;

export type KobaTokenKey = keyof typeof kobaTokens;
