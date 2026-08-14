import { NextResponse } from "next/server";
import { jsonServerError } from "@/features/servers/lib/http";
import { getBySlugOrRef } from "@/features/servers/services/server.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await context.params;
  try {
    return NextResponse.json(await getBySlugOrRef(serverId));
  } catch (error) {
    return jsonServerError(error, "Could not load server.");
  }
}
