"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";
import { safeStaffCallbackPath } from "@/lib/security/safe-redirect";

export function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeStaffCallbackPath(searchParams.get("callbackUrl"));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/staff-mfa/challenge", { method: "PUT", cache: "no-store" }).then(
      async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { next?: string };
        if (data.next === "enroll") {
          router.replace("/settings/security/mfa");
        }
      },
    );
  }, [router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff-mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as {
        error?: string;
        mfaTicket?: string;
      };
      if (!response.ok || !data.mfaTicket) {
        setError(data.error ?? "Invalid authentication code.");
        setBusy(false);
        return;
      }
      const signed = await signIn("credentials", {
        mfaTicket: data.mfaTicket,
        redirect: false,
      });
      if (signed?.error) {
        setError("Could not complete sign-in. Try again.");
        setBusy(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Could not verify the code.");
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Staff verification"
      description="Enter the 6-digit authenticator code or a one-time recovery code."
    >
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
        <FormField id="code" label="Authentication code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Verifying…" : "Continue"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-neon-lime hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
