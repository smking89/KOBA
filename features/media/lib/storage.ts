/** Host allowlist + optional S3/R2-compatible uploads for https media URLs. */

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function mediaAllowedHosts(): string[] {
  const hosts: string[] = [];
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (publicBase) {
    try {
      hosts.push(new URL(publicBase).host.toLowerCase());
    } catch {
      /* ignore invalid */
    }
  }

  const extra = process.env.MEDIA_ALLOWED_HOSTS?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const host = part.trim().toLowerCase();
      if (host) hosts.push(host);
    }
  }

  return [...new Set(hosts)];
}

/**
 * When an allowlist is configured, media URLs must be https and on an allowed host.
 * When empty, any https URL is accepted (current Phase 11 behavior).
 */
export function isAllowedMediaUrl(value: string): boolean {
  if (!isHttpsUrl(value)) {
    return false;
  }

  const allowed = mediaAllowedHosts();
  if (allowed.length === 0) {
    return true;
  }

  try {
    const host = new URL(value).host.toLowerCase();
    return allowed.includes(host);
  } catch {
    return false;
  }
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
    process.env.S3_ACCESS_KEY_ID?.trim() &&
    !process.env.S3_ACCESS_KEY_ID.includes("replace") &&
    process.env.S3_SECRET_ACCESS_KEY?.trim() &&
    !process.env.S3_SECRET_ACCESS_KEY.includes("replace") &&
    process.env.S3_PUBLIC_BASE_URL?.trim(),
  );
}

export type PresignResult = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresInSeconds: number;
};

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Creates a presigned PUT URL for S3-compatible storage (AWS S3, R2, MinIO).
 * Uses AWS Signature V4 via fetch-compatible SDK when packages are available;
 * otherwise throws NOT_CONFIGURED.
 */
export async function createPresignedUpload(input: {
  userId: string;
  filename: string;
  contentType: string;
  folder?: string;
}): Promise<PresignResult> {
  if (!isObjectStorageConfigured()) {
    throw new Error("Object storage is not configured.");
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const bucket = process.env.S3_BUCKET!.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const publicBase = process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "");
  const folder = input.folder ?? "uploads";
  const safeName = sanitizeFilename(input.filename) || "file";
  const key = `${folder}/${input.userId}/${Date.now()}-${safeName}`;

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: input.contentType,
  });

  const expiresInSeconds = 60 * 5;
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const publicUrl = `${publicBase}/${key}`;

  return { uploadUrl, publicUrl, key, expiresInSeconds };
}
