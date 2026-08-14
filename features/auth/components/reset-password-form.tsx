"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";
import { resetPasswordSchema } from "@/features/auth/schemas/auth.schemas";
import { z } from "zod";

type ResetPasswordFormInput = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email, token, password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFormError(payload.error ?? "Reset failed. Request a new link.");
      return;
    }

    router.push("/login?verified=1");
  });

  if (!token || !email) {
    return (
      <AuthCard title="Invalid reset link" description="This password reset link is incomplete.">
        <AuthAlert variant="error">Missing token or email in the URL.</AuthAlert>
        <p className="text-center text-sm text-muted">
          <Link href="/forgot-password" className="font-medium text-neon-lime hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Set a strong password for your account.">
      {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" {...register("email")} />
        <input type="hidden" {...register("token")} />

        <FormField id="password" label="New password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}
