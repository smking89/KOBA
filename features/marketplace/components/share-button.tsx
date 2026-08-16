"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShareButton({
  slug,
  title,
  className,
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/market/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported mid-call — fall through to clipboard.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        void share();
      }}
      aria-label={copied ? "Link copied" : "Share this listing"}
      title={copied ? "Link copied" : "Share"}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-neon-lime transition-transform hover:scale-110",
        className,
      )}
    >
      <Share2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
