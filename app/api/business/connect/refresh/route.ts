import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import { refreshConnectAccount } from "@/features/payments/services/connect.service";

export async function POST() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const status = await refreshConnectAccount(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    return NextResponse.json({ error: "Could not refresh Connect status." }, { status: 500 });
  }
}
