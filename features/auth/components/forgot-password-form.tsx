"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas/auth.schemas";

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setFormError(payload.error ?? "Request failed. Try again.");
      return;
    }

    setSent(true);
  });

  return (
    <AuthCard
      title="Reset password"
      description="Enter your email and we'll send a reset link if an account exists."
    >
      {sent ? (
        <AuthAlert variant="success">
          If an account exists for that email, a reset link was sent. Check the dev console in local
          development.
        </AuthAlert>
      ) : null}
      {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting || sent}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-neon-lime hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
