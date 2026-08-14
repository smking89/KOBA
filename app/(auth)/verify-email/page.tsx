import { Suspense } from "react";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";

export const metadata = {
  title: "Verify email",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
      <VerifyEmailPanel />
    </Suspense>
  );
}
