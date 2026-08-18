import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");
const LOGO = path.join(ROOT, "public", "brand", "koba-logo.png");

/**
 * Builds install icons from the official KOBA logo on the product
 * background. Maskable icons keep ~20% safe-zone padding (Android
 * adaptive icons). Monochrome (client, 2026-08-17: "the logo needs to
 * use the black and white color scheme, same for the favicon" — part of
 * the platform-wide gradient/brand-orange → black-and-white pivot): the
 * logo is tinted pure white via the standard sharp `dest-in` blend
 * (tint a solid color using the source PNG's own alpha as the mask,
 * same technique used for koba-plus-mark.png elsewhere) before
 * compositing onto a black background, rather than kept brand-orange —
 * static app icons can't follow the live light/dark toggle, so this
 * picks the one fixed rendering (white-on-black) rather than the
 * previous always-orange one.
 */
async function renderIcon({ size, maskable }) {
  const paddingRatio = maskable ? 0.22 : 0.14;
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;

  const resizedMask = await sharp(LOGO)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .toBuffer();

  const whiteLogo = await sharp({
    create: { width: inner, height: inner, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: resizedMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: whiteLogo, left: padding, top: padding }])
    .png()
    .toBuffer();
}

const outputs = [
  { file: "icon-192x192.png", size: 192, maskable: false },
  { file: "icon-512x512.png", size: 512, maskable: false },
  { file: "icon-maskable-512x512.png", size: 512, maskable: true },
  { file: "../apple-touch-icon.png", size: 180, maskable: false },
];

await fs.access(LOGO);

await fs.mkdir(OUT_DIR, { recursive: true });

for (const { file, size, maskable } of outputs) {
  const dest = file.startsWith("..")
    ? path.join(ROOT, "public", path.basename(file))
    : path.join(OUT_DIR, file);

  const buffer = await renderIcon({ size, maskable });
  await fs.writeFile(dest, buffer);
  console.log(`Wrote ${path.relative(ROOT, dest)}`);
}
