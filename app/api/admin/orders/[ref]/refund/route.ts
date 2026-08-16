import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refundOrder } from "@/features/payments/services/checkout.service";
import { assertCanStaffRefund } from "@/features/admin/services/admin.service";
import { jsonAdminError } from "@/features/admin/lib/http";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { ref } = await context.params;
  try {
    await assertCanStaffRefund(session.user.id);
    const order = await refundOrder(session.user.id, ref, true);
    return NextResponse.json({ publicRef: order.publicRef, status: order.status });
  } catch (error) {
    const mfa = jsonAdminError(error, "Could not refund order.");
    return mfa;
  }
}
