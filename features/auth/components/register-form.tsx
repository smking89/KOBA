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
import {
  ACCOUNT_TYPE_LABEL,
  PUBLIC_ACCOUNT_TYPES,
  type PublicAccountType,
} from "@/features/koba-id/lib/format";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { accountType: "PLAYER" },
  });

  const accountType = watch("accountType");

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
      description="Choose Player, Business, or Influencer. Staff KOBAIDs are issued by KOBA, never here."
    >
      {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Account type</p>
          <div className="grid grid-cols-3 gap-2">
            {PUBLIC_ACCOUNT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setValue("accountType", type as PublicAccountType)}
                className={cn(
                  "rounded-md border px-2 py-2 text-xs font-semibold",
                  accountType === type
                    ? "border-neon-lime bg-neon-lime/10 text-neon-lime"
                    : "border-border text-muted hover:text-foreground",
                )}
              >
                {ACCOUNT_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>

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
