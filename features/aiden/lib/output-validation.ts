export const AIDEN_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type AidenAllowedMime = (typeof AIDEN_ALLOWED_MIME)[number];

export const AIDEN_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
export const AIDEN_MAX_DIMENSION = 2048;
export const AIDEN_MIN_DIMENSION = 1;
export const AIDEN_FETCH_TIMEOUT_MS = 12_000;

/// A textured, rigged glTF binary can legitimately be much larger than
/// a flat PNG/JPEG — the existing AIDEN_MAX_OUTPUT_BYTES/AIDEN_ALLOWED_MIME
/// pair above is image-only and was never meant to bound a mesh
/// download (features/aiden/lib/blender-assembly.ts uses these instead
/// when fetching a Tripo mesh, not the image limits).
export const AIDEN_MAX_MESH_BYTES = 64 * 1024 * 1024;
export const AIDEN_MESH_ACCEPT = "model/gltf-binary,application/octet-stream";

export function isAllowedAidenMime(value: string): value is AidenAllowedMime {
  return (AIDEN_ALLOWED_MIME as readonly string[]).includes(value);
}

export function validateImageLimits(input: {
  mime: string;
  byteSize: number;
  width?: number | undefined;
  height?: number | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (!isAllowedAidenMime(input.mime)) {
    return { ok: false, reason: `Unsupported MIME type: ${input.mime}` };
  }
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) {
    return { ok: false, reason: "Invalid file size." };
  }
  if (input.byteSize > AIDEN_MAX_OUTPUT_BYTES) {
    return { ok: false, reason: "Generated file exceeds the size limit." };
  }
  if (
    input.width != null &&
    (input.width < AIDEN_MIN_DIMENSION || input.width > AIDEN_MAX_DIMENSION)
  ) {
    return { ok: false, reason: "Image width is outside allowed bounds." };
  }
  if (
    input.height != null &&
    (input.height < AIDEN_MIN_DIMENSION || input.height > AIDEN_MAX_DIMENSION)
  ) {
    return { ok: false, reason: "Image height is outside allowed bounds." };
  }
  return { ok: true };
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIG)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function readPngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIG)) return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

export function safeAidenFilename(publicRef: string, mime: string): string {
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  const slug = publicRef.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `${slug}.${ext}`;
}
