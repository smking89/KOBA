/**
 * KOBA brand tokens — fire red/orange/gold gaming identity (rebrand,
 * 2026-08-16, replacing the earlier neon lime/mint identity). Names kept
 * as-is (neonLime/neonMint) to match app/globals.css's CSS variables of
 * the same name — only the values moved.
 * Prefer these semantic names over raw hex in components.
 */
export const kobaTokens = {
  background: "#050505",
  surface: "#0D0F0E",
  surfaceSecondary: "#141816",
  text: "#F5FFF8",
  textMuted: "#98A69D",
  neonLime: "#FF5A1F",
  electricGreen: "#35FF52",
  neonMint: "#FFB627",
  border: "rgba(255, 90, 31, 0.18)",
  error: "#FF4D5E",
  warning: "#FFB020",
  success: "#35FF52",
  brandGradient: "linear-gradient(135deg, #F5341E 0%, #FF7A1A 50%, #FFC02E 100%)",
  themeColor: "#FF5A1F",
} as const;

export type KobaTokenKey = keyof typeof kobaTokens;
