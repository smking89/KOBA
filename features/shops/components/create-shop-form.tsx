"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/form-field";
import { createShopSchema } from "@/features/shops/schemas/shop.schemas";
import type { z } from "zod";

type CreateShopInput = z.infer<typeof createShopSchema>;

export function CreateShopForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateShopInput>({
    resolver: zodResolver(createShopSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const response = await fetch("/api/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string; slug?: string };
    if (!response.ok) {
      setFormError(payload.error ?? "Could not create shop.");
      return;
    }
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <FormField id="name" label="Shop name" error={errors.name?.message}>
        <Input id="name" maxLength={64} {...register("name")} />
      </FormField>
      <FormField id="bio" label="About the shop" error={errors.bio?.message}>
        <Textarea id="bio" rows={4} maxLength={500} {...register("bio")} />
      </FormField>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Opening…" : "Open shop"}
      </Button>
    </form>
  );
}
