/**
 * Ephemeral QR rendering for TOTP enrollment.
 * The PNG is returned once in the enrollment response and never stored.
 */
export async function totpQrDataUrl(otpauthUri: string): Promise<string> {
  const qrcode = await import("qrcode");
  return qrcode.toDataURL(otpauthUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
