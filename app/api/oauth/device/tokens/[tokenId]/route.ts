import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DeviceFlowError, revokeAccessToken } from "@/features/oauth-device/services/device-flow.service";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { tokenId } = await params;

  try {
    await revokeAccessToken(session.user.id, tokenId);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    if (error instanceof DeviceFlowError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not revoke." }, { status: 500 });
  }
}
