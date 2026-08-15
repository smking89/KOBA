import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAiden, jsonAidenError, aidenNoStore } from "@/features/aiden/lib/http";
import { getAssetMedia } from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const { ref } = await context.params;
  try {
    const media = await getAssetMedia(session.user.id, ref);
    if (media.mode === "redirect") {
      return NextResponse.redirect(media.url, { headers: aidenNoStore });
    }
    return new NextResponse(new Uint8Array(media.bytes), {
      status: 200,
      headers: {
        ...aidenNoStore,
        "Content-Type": media.mime,
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden preview.");
  }
}
