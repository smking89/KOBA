export const DEV_ALLOWED_ARTIFACT_EXT = ["zip", "gz", "tgz", "tar", "json", "txt", "md"] as const;
export const DEV_ALLOWED_ARTIFACT_MIME = [
  "application/zip",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/json",
  "text/plain",
  "text/markdown",
] as const;

export const DEV_MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

export function sanitizeArtifactFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "artifact.zip";
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^\.+/, "")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "artifact.zip"
  );
}

export function artifactExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  if (parts.length > 2 && parts[parts.length - 2] === "tar") return "tar";
  return parts.at(-1) ?? "";
}

export function isAllowedArtifact(filename: string, mime: string): boolean {
  const ext = artifactExtension(filename);
  return (
    (DEV_ALLOWED_ARTIFACT_EXT as readonly string[]).includes(ext) &&
    (DEV_ALLOWED_ARTIFACT_MIME as readonly string[]).includes(mime)
  );
}

function hasExecutableSignature(bytes: Buffer): boolean {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return true; // PE (MZ)
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes.toString("ascii", 1, 4) === "ELF") {
    return true;
  }
  if (bytes.length >= 4) {
    const magic = bytes.readUInt32BE(0);
    // Mach-O (both endiannesses) and universal binaries.
    if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(magic)) {
      return true;
    }
  }
  return false;
}

function isGzipBytes(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isZipBytes(bytes: Buffer): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function isTarBytes(bytes: Buffer): boolean {
  return bytes.length >= 262 && bytes.toString("ascii", 257, 262) === "ustar";
}

/**
 * Magic-byte validation for uploaded artifacts (KOBA-MED-001). Rejects native
 * executables outright and requires the content signature to match the
 * declared extension. This is not malware scanning; archives still enter
 * QUARANTINE and require staff review before download.
 */
export function artifactBytesMatchExtension(bytes: Buffer, filename: string): boolean {
  if (bytes.length === 0) return false;
  if (hasExecutableSignature(bytes)) return false;
  const ext = artifactExtension(filename);
  switch (ext) {
    case "zip":
      return isZipBytes(bytes);
    case "gz":
    case "tgz":
      return isGzipBytes(bytes);
    case "tar":
      // artifactExtension maps "*.tar.gz" to "tar", so accept gzip here too.
      return isTarBytes(bytes) || isGzipBytes(bytes);
    case "json":
    case "txt":
    case "md":
      return !bytes.subarray(0, 1024).includes(0);
    default:
      return false;
  }
}
