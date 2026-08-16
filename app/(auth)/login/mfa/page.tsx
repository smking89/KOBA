import { Suspense } from "react";
import { MfaChallengeForm } from "@/features/staff-mfa/components/mfa-challenge-form";

export const metadata = { title: "Staff verification" };
export const dynamic = "force-dynamic";

export default function StaffMfaChallengePage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
      <MfaChallengeForm />
    </Suspense>
  );
}
