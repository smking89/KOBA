import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { flagDisputeSchema } from "@/features/payments/schemas/dispute.schemas";
import { flagDispute } from "@/features/payments/services/escrow.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = flagDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dispute payload." }, { status: 400 });
  }

  const { ref } = await context.params;
  try {
    const escrow = await flagDispute(session.user.id, ref, parsed.data.reason);
    return NextResponse.json({ publicRef: ref, status: escrow.status });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not flag dispute." }, { status: 500 });
  }
}
