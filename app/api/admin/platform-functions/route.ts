import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePlatformFunctions } from "@/features/platform-control/lib/functions";
import { listPlatformFunctions } from "@/features/platform-control/services/platform-function.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  const actorTypes = actor?.kobaIdentities.map((row) => row.accountType) ?? [];
  if (!canManagePlatformFunctions(actorTypes)) {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }

  const functions = await listPlatformFunctions();
  return NextResponse.json({ functions });
}
