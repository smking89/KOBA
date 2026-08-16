"use client";

import { useState } from "react";

export function ServerFavouriteButton({
  slug,
  initialFavourited = false,
  initialCount = 0,
}: {
  slug: string;
  initialFavourited?: boolean;
  initialCount?: number;
}) {
  const [favourited, setFavourited] = useState(initialFavourited);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${slug}/favourite`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        favourited?: boolean;
        favouriteCount?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update favourite.");
        return;
      }
      if (typeof data.favourited === "boolean") setFavourited(data.favourited);
      if (typeof data.favouriteCount === "number") setCount(data.favouriteCount);
    } catch {
      setError("Network required.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm disabled:opacity-50"
        aria-pressed={favourited}
      >
        {favourited ? "Favourited" : "Favourite"} · {count}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
