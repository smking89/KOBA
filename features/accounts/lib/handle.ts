import { randomBytes } from "node:crypto";

export function slugifyHandle(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "player";
}

export function allocateHandleCandidate(displayName: string): string {
  const base = slugifyHandle(displayName);
  return `${base}-${randomBytes(2).toString("hex")}`;
}
