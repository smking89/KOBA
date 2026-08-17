"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { DEV_PRODUCT_CATEGORIES, categoryLabel } from "@/features/developers/lib/categories";

export function StoreCategoryTabs({ current }: { current?: string | undefined }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(category: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set("category", category);
    else params.delete("category");
    router.push(`/apps${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <nav
      className="flex flex-wrap gap-2 overflow-x-auto pb-1"
      aria-label="App categories"
    >
      <button
        type="button"
        onClick={() => go(null)}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          !current
            ? "bg-[var(--store-ink)] text-white"
            : "bg-[var(--store-surface-2)] text-[var(--store-ink-dim)] hover:text-[var(--store-ink)]",
        )}
      >
        All
      </button>
      {DEV_PRODUCT_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => go(category)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            current === category
              ? "bg-[var(--store-ink)] text-white"
              : "bg-[var(--store-surface-2)] text-[var(--store-ink-dim)] hover:text-[var(--store-ink)]",
          )}
        >
          {categoryLabel(category)}
        </button>
      ))}
    </nav>
  );
}
