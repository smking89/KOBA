"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TagPrivacy } from "@/features/social/lib/rules";

export function TagPrivacyForm({ initial, bio }: { initial: TagPrivacy; bio: string }) {
  const router = useRouter();
  const [tagPrivacy, setTagPrivacy] = useState<TagPrivacy>(initial);
  const [nextBio, setNextBio] = useState(bio);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/social/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagPrivacy, bio: nextBio }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Could not save tagging settings.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="block text-sm">
        Who can tag you
        <select
          className="mt-1 h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          value={tagPrivacy}
          onChange={(event) => setTagPrivacy(event.target.value as TagPrivacy)}
        >
          <option value="EVERYONE">Everyone</option>
          <option value="FOLLOWERS">Followers only</option>
          <option value="NO_ONE">No one</option>
        </select>
      </label>
      <label className="block text-sm">
        Bio
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          maxLength={280}
          value={nextBio}
          onChange={(event) => setNextBio(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted">
        Blocked accounts can never tag you, regardless of this setting.
      </p>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save privacy"}
      </Button>
    </form>
  );
}
