"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas/auth.schemas";

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFormError(payload.error ?? "Registration failed. Try again.");
      return;
    }

    router.push("/verify-email?sent=1");
  });

  return (
    <AuthCard
      title="Create account"
      description="Join KOBA. Player accounts only — staff roles are assigned separately."
    >
      {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField id="name" label="Display name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" {...register("name")} />
        </FormField>

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </FormField>

        <FormField id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </FormField>
        <p className="text-xs text-muted">
          At least 12 characters with uppercase, lowercase, and a number.
        </p>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-neon-lime hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
