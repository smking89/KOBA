/**
 * KOBA brand tokens — neon lime gaming identity.
 * Prefer these semantic names over raw hex in components.
 */
export const kobaTokens = {
  background: "#050505",
  surface: "#0D0F0E",
  surfaceSecondary: "#141816",
  text: "#F5FFF8",
  textMuted: "#98A69D",
  neonLime: "#B8FF00",
  electricGreen: "#35FF52",
  neonMint: "#00F5A0",
  border: "rgba(184, 255, 0, 0.18)",
  error: "#FF4D5E",
  warning: "#FFB020",
  success: "#35FF52",
  brandGradient: "linear-gradient(135deg, #C6FF00 0%, #55FF35 48%, #00F5A0 100%)",
  themeColor: "#B8FF00",
} as const;

export type KobaTokenKey = keyof typeof kobaTokens;
