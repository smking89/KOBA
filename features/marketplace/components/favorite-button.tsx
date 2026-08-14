"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  slug,
  initialFavorited,
  signedIn,
}: {
  slug: string;
  initialFavorited: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${slug}`);
      return;
    }

    setBusy(true);
    const response = await fetch("/api/market/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const payload = (await response.json()) as { favorited?: boolean };
    setBusy(false);

    if (response.ok && typeof payload.favorited === "boolean") {
      setFavorited(payload.favorited);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from saved" : "Save listing"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface/90 text-muted hover:text-foreground",
        favorited && "border-neon-lime/50 text-neon-lime",
      )}
    >
      <Bookmark
        className={cn("h-4 w-4", favorited && "fill-current")}
        suppressHydrationWarning
      />
    </button>
  );
}
