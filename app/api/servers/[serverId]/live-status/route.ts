import { NextResponse } from "next/server";
import { jsonServerError } from "@/features/servers/lib/http";
import { getLiveServerStatus } from "@/features/servers/services/server.service";

export async function GET(_request: Request, context: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await context.params;
  try {
    const status = await getLiveServerStatus(serverId);
    return NextResponse.json({ status });
  } catch (error) {
    return jsonServerError(error, "Could not fetch live server status.");
  }
}
