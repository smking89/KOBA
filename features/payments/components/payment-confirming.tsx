"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PaymentConfirming({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(id);
  }, [active, router]);

  if (!active) {
    return null;
  }

  return (
    <p className="text-sm text-muted">
      Confirming payment with Stripe. This receipt updates automatically — the browser cannot mark
      an order paid.
    </p>
  );
}
