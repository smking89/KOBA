/**
 * KOBA brand tokens — neon lime on Discord-like layered charcoal.
 * Prefer these semantic names over raw hex in components.
 */
export const kobaTokens = {
  background: "#0B0C0B",
  surface: "#161916",
  surfaceSecondary: "#1C201E",
  surfaceTertiary: "#232826",
  text: "#F2F7F3",
  textMuted: "#8B958E",
  neonLime: "#B8FF00",
  electricGreen: "#3BA55D",
  neonMint: "#00F5A0",
  border: "rgba(255, 255, 255, 0.06)",
  error: "#ED4245",
  warning: "#FAA81A",
  success: "#3BA55D",
  brandGradient: "linear-gradient(135deg, #C6FF00 0%, #55FF35 48%, #00F5A0 100%)",
  themeColor: "#B8FF00",
} as const;

export type KobaTokenKey = keyof typeof kobaTokens;
