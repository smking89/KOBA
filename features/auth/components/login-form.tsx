"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";
import { loginSchema, type LoginInput } from "@/features/auth/schemas/auth.schemas";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"));
  const verified = searchParams.get("verified") === "1";
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const gateResponse = await fetch("/api/staff-mfa/login-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ email: values.email, password: values.password }),
    });
    const gate = (await gateResponse.json().catch(() => null)) as {
      next?: string;
      error?: string;
    } | null;
    if (!gateResponse.ok) {
      setFormError(
        "Invalid email or password, or your email is not verified yet. Check your inbox for the verification link.",
      );
      return;
    }
    if (gate?.next === "mfa") {
      router.push(`/login/mfa?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      setFormError(
        "Invalid email or password, or your email is not verified yet. Check your inbox for the verification link.",
      );
      return;
    }

    router.push(gate?.next === "enroll" ? "/settings/security/mfa" : callbackUrl);
    router.refresh();
  });

  async function resendVerification() {
    const email = getValues("email");
    setResendState("sending");
    setFormError(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setFormError("Could not resend verification. Try again in a few minutes.");
        setResendState("idle");
        return;
      }
      setResendState("sent");
    } catch {
      setFormError("Could not resend verification. Try again in a few minutes.");
      setResendState("idle");
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access your KOBA account. Email must be verified before login."
    >
      {verified ? (
        <AuthAlert variant="success">Email verified. You can sign in now.</AuthAlert>
      ) : null}
      {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}
      {resendState === "sent" ? (
        <AuthAlert variant="info">
          If this account needs verification, a new link was sent. In local development, open the
          link printed in the terminal running the app.
        </AuthAlert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </FormField>

        <FormField id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </FormField>

        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-neon-lime hover:underline">
            Forgot password?
          </Link>
          <button
            type="button"
            className="text-muted hover:text-foreground hover:underline disabled:opacity-50"
            disabled={resendState === "sending"}
            onClick={() => void resendVerification()}
          >
            {resendState === "sending" ? "Sending…" : "Resend verification"}
          </button>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="font-medium text-neon-lime hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}
