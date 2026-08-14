"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/form-field";
import { createGroupSchema } from "@/features/groups/schemas/group.schemas";
import type { z } from "zod";

type CreateGroupInput = z.infer<typeof createGroupSchema>;

export function CreateGroupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { visibility: "PUBLIC" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string; slug?: string };
    if (!response.ok) {
      setFormError(payload.error ?? "Could not create group.");
      return;
    }
    if (payload.slug) {
      router.push(`/groups/${payload.slug}`);
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <FormField id="name" label="Group name" error={errors.name?.message}>
        <Input id="name" maxLength={64} {...register("name")} />
      </FormField>
      <FormField id="bio" label="About the group" error={errors.bio?.message}>
        <Textarea id="bio" rows={4} maxLength={500} {...register("bio")} />
      </FormField>
      <FormField id="visibility" label="Visibility" error={errors.visibility?.message}>
        <select
          id="visibility"
          className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          {...register("visibility")}
        >
          <option value="PUBLIC">Public — anyone can join</option>
          <option value="PRIVATE">Private — request or invite</option>
        </select>
      </FormField>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
