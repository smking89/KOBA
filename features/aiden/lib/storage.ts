import { isObjectStorageConfigured } from "@/features/media/lib/storage";
import { safeAidenFilename } from "@/features/aiden/lib/output-validation";

export async function storeAidenObject(input: {
  userId: string;
  publicRef: string;
  mime: string;
  bytes: Buffer;
}): Promise<{ key: string; stored: "s3" | "inline" }> {
  const filename = safeAidenFilename(input.publicRef, input.mime);
  const key = `aiden/${input.userId}/${filename}`;
  if (!isObjectStorageConfigured()) {
    return { key, stored: "inline" };
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    ...(process.env.S3_ENDPOINT?.trim()
      ? { endpoint: process.env.S3_ENDPOINT.trim(), forcePathStyle: true }
      : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!.trim(),
      Key: key,
      Body: input.bytes,
      ContentType: input.mime,
      ACL: undefined,
    }),
  );
  return { key, stored: "s3" };
}

export async function signAidenObjectUrl(
  key: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  if (!isObjectStorageConfigured()) return null;
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    ...(process.env.S3_ENDPOINT?.trim()
      ? { endpoint: process.env.S3_ENDPOINT.trim(), forcePathStyle: true }
      : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET!.trim(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
