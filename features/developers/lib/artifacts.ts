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
