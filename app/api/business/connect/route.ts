import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { PaymentError, paymentErrorStatus } from "@/features/payments/lib/errors";
import {
  getConnectStatus,
  startConnectOnboarding,
} from "@/features/payments/services/connect.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const status = await getConnectStatus(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    return NextResponse.json({ error: "Could not load payout status." }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = rateLimit(`connect:${session.user.id}`, 8, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many onboarding attempts." }, { status: 429 });
  }
  try {
    const result = await startConnectOnboarding(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: paymentErrorStatus(error.code) },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Could not start Connect onboarding." }, { status: 500 });
  }
}
