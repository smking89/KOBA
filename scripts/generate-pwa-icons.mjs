import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");

/** Brand mark SVG — gradient tile + K on dark ground (placeholder until official logo). */
function buildMarkSvg({ maskable = false }) {
  const padding = maskable ? 128 : 64;
  const tileSize = 512 - padding * 2;
  const tileX = padding;
  const tileY = padding;
  const radius = maskable ? 48 : 72;
  const fontSize = maskable ? 160 : 220;
  const textY = maskable ? 300 : 320;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="kobaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C6FF00"/>
      <stop offset="48%" stop-color="#55FF35"/>
      <stop offset="100%" stop-color="#00F5A0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#050505"/>
  <rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" rx="${radius}" fill="url(#kobaGrad)"/>
  <text x="256" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="#050505">K</text>
</svg>`;
}

const outputs = [
  { file: "icon-192x192.png", size: 192, maskable: false },
  { file: "icon-512x512.png", size: 512, maskable: false },
  { file: "icon-maskable-512x512.png", size: 512, maskable: true },
  { file: "../apple-touch-icon.png", size: 180, maskable: false },
];

await fs.mkdir(OUT_DIR, { recursive: true });

for (const { file, size, maskable } of outputs) {
  const svg = buildMarkSvg({ maskable });
  const dest = file.startsWith("..")
    ? path.join(ROOT, "public", path.basename(file))
    : path.join(OUT_DIR, file);

  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(dest);
  console.log(`Wrote ${path.relative(ROOT, dest)}`);
}
