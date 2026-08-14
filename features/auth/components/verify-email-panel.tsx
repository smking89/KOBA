"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";

type VerifyState = "idle" | "loading" | "success" | "error";

export function VerifyEmailPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sent = searchParams.get("sent") === "1";
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [state, setState] = useState<VerifyState>(token && email ? "loading" : "idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !email) {
      return;
    }

    let cancelled = false;

    async function verify() {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });

      const payload = (await response.json()) as { error?: string };

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setState("error");
        setMessage(payload.error ?? "Verification failed.");
        return;
      }

      setState("success");
      setMessage("Email verified. Redirecting to sign in…");
      setTimeout(() => router.push("/login?verified=1"), 1500);
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token, email, router]);

  if (sent && !token) {
    return (
      <AuthCard
        title="Check your inbox"
        description="We sent a verification link to your email address."
      >
        <AuthAlert variant="info">
          In local development, the link is printed in the terminal running{" "}
          <code className="font-mono text-xs">pnpm dev</code>.
        </AuthAlert>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-neon-lime hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (state === "loading") {
    return (
      <AuthCard title="Verifying email" description="Confirming your verification link…">
        <AuthAlert variant="info">Please wait.</AuthAlert>
      </AuthCard>
    );
  }

  if (state === "success") {
    return (
      <AuthCard title="Email verified">
        <AuthAlert variant="success">{message}</AuthAlert>
        <Link
          href="/login?verified=1"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-gradient px-4 text-sm font-semibold text-background shadow-soft hover:opacity-95"
        >
          Continue to sign in
        </Link>
      </AuthCard>
    );
  }

  if (state === "error") {
    return (
      <AuthCard title="Verification failed">
        <AuthAlert variant="error">{message}</AuthAlert>
        <p className="text-center text-sm text-muted">
          <Link href="/register" className="font-medium text-neon-lime hover:underline">
            Register again
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verify your email" description="Open the link we sent after registration.">
      <AuthAlert variant="info">
        No verification token in this URL. Register or check your inbox for the link.
      </AuthAlert>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-neon-lime hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
