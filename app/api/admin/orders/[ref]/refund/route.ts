import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { actorIsStaff } from "@/features/payments/lib/staff";
import { refundOrder } from "@/features/payments/services/checkout.service";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const staff = await actorIsStaff(session.user.id);
  if (!staff) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const { ref } = await context.params;
  try {
    const order = await refundOrder(session.user.id, ref, true);
    return NextResponse.json({ publicRef: order.publicRef, status: order.status });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not refund order." }, { status: 500 });
  }
}
