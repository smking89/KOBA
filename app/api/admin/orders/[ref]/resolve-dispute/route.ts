import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { actorIsStaff } from "@/features/payments/lib/staff";
import { resolveDisputeSchema } from "@/features/payments/schemas/dispute.schemas";
import { resolveDispute } from "@/features/payments/services/escrow.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const staff = await actorIsStaff(session.user.id);
  if (!staff) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = resolveDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resolution payload." }, { status: 400 });
  }

  const { ref } = await context.params;
  try {
    const escrow = await resolveDispute(session.user.id, ref, parsed.data.resolution);
    return NextResponse.json({ publicRef: ref, status: escrow?.status ?? null });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not resolve dispute." }, { status: 500 });
  }
}
