// Prepares the official KOBA logo for in-app use.
//
// The source export is a bright lime/mint mark on a solid black background with
// heavy padding. This keys the black to transparent (using per-pixel brightness
// so the anti-aliased edges are preserved), trims the surrounding padding, and
// writes a square transparent PNG that sits cleanly on the dark UI.
//
// Usage: node scripts/prepare-brand-logo.mjs <source.png>

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error("Source image not found. Pass the path as the first argument.");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "public", "brand");
const outFile = path.join(outDir, "koba-logo.png");

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const out = Buffer.from(data);

for (let i = 0; i < out.length; i += channels) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  // Brightness of the brightest channel keys the black backdrop out while
  // keeping the green stroke fully opaque and its edges smooth.
  const brightness = Math.max(r, g, b);
  out[i + 3] = brightness;
}

await mkdir(outDir, { recursive: true });

await sharp(out, { raw: { width, height, channels } })
  .png()
  .trim({ threshold: 10 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile(outFile);

console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
