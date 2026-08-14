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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const verified = searchParams.get("verified") === "1";
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
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

    router.push(callbackUrl);
    router.refresh();
  });

  return (
    <AuthCard
      title="Sign in"
      description="Access your KOBA account. Email must be verified before login."
    >
      {verified ? (
        <AuthAlert variant="success">Email verified. You can sign in now.</AuthAlert>
      ) : null}
      {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}

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
