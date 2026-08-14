import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");
const LOGO = path.join(ROOT, "public", "brand", "koba-logo.png");

/**
 * Builds install icons from the official KOBA logo on the product background.
 * Maskable icons keep ~20% safe-zone padding (Android adaptive icons).
 */
async function renderIcon({ size, maskable }) {
  const paddingRatio = maskable ? 0.22 : 0.14;
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;

  const logo = await sharp(LOGO)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 5, g: 5, b: 5, alpha: 1 },
    },
  })
    .composite([{ input: logo, left: padding, top: padding }])
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
