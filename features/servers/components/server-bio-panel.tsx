"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ServerBioPanel({
  serverSlug,
  initialBio,
  signedIn,
}: {
  serverSlug: string;
  initialBio: string | null;
  signedIn: boolean;
}) {
  const [bio, setBio] = useState(initialBio ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/servers/${serverSlug}/bio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      bio?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save bio.");
      return;
    }
    setEditing(false);
    if (payload.bio !== undefined) {
      setBio(payload.bio);
    }
  }

  if (!signedIn) {
    return null;
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {bio ? <p className="text-sm">{bio}</p> : <p className="text-sm text-muted">No bio set for this server yet.</p>}
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          {bio ? "Edit" : "Set a bio"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Textarea
        value={bio}
        maxLength={280}
        rows={3}
        onChange={(event) => setBio(event.target.value)}
        placeholder="A bio just for this server's community — KOBA Plus perk."
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
