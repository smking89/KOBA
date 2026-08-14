"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/form-field";
import { shopReviewSchema } from "@/features/shops/schemas/shop.schemas";
import type { z } from "zod";

type ReviewInput = z.infer<typeof shopReviewSchema>;

export function ShopReviewForm({
  slug,
  signedIn,
  isOwner,
}: {
  slug: string;
  signedIn: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({
    resolver: zodResolver(shopReviewSchema),
    defaultValues: { rating: 5 },
  });

  if (isOwner) {
    return <p className="text-sm text-muted">Shop owners cannot review their own shop.</p>;
  }

  if (!signedIn) {
    return (
      <p className="text-sm text-muted">
        <button
          type="button"
          className="text-neon-lime hover:underline"
          onClick={() => router.push(`/login?callbackUrl=/shops/${slug}`)}
        >
          Sign in
        </button>{" "}
        to leave a review.
      </p>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const response = await fetch(`/api/shops/${slug}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFormError(payload.error ?? "Could not save review.");
      return;
    }
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <FormField id="rating" label="Rating" error={errors.rating?.message}>
        <select
          id="rating"
          className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          {...register("rating", { valueAsNumber: true })}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="body" label="Review" error={errors.body?.message}>
        <Textarea id="body" rows={3} maxLength={1000} {...register("body")} />
      </FormField>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Submit review"}
      </Button>
    </form>
  );
}
