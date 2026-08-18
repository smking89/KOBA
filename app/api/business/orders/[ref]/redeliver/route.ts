import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { redeliverRconKitForOrder } from "@/features/payments/services/rcon-delivery.service";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { ref } = await context.params;
  try {
    const order = await redeliverRconKitForOrder(session.user.id, ref);
    return NextResponse.json({
      publicRef: order.publicRef,
      rconDeliveryStatus: order.rconDeliveryStatus,
      rconDeliveryError: order.rconDeliveryError,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    return NextResponse.json({ error: "Could not retry delivery." }, { status: 500 });
  }
}
