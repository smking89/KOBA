import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { createPresignedUpload, isObjectStorageConfigured } from "@/features/media/lib/storage";
import { presignMediaSchema } from "@/features/media/schemas/media.schemas";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isObjectStorageConfigured()) {
    return NextResponse.json(
      {
        error: "Object storage is not configured.",
        code: "NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`media-presign:${session.user.id}:${ip}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many upload requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = presignMediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    const result = await createPresignedUpload({
      userId: session.user.id,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      folder: parsed.data.folder ?? "uploads",
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
  }
}
