"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Self-reported gamertag/PSN-username linking (client, 2026-08-18) —
 * no OAuth round-trip like Steam's, since Xbox Live/PSN have no public
 * ownership-verification API. Shared by the Xbox and PlayStation cards
 * in ConnectedDevicesPanel — same type-and-save UX either way. */
export function TextIdentityLink({
  label,
  placeholder,
  apiPath,
  bodyKey,
  initialValue,
}: {
  label: string;
  placeholder: string;
  apiPath: string;
  bodyKey: string;
  initialValue: string | null;
}) {
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!draft.trim()) return;
    setPending(true);
    setError(null);
    const response = await fetch(apiPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [bodyKey]: draft.trim() }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not link.");
      return;
    }
    setValue(draft.trim());
    setDraft("");
  }

  async function unlink() {
    setPending(true);
    setError(null);
    const response = await fetch(apiPath, { method: "DELETE" });
    setPending(false);
    if (response.ok) setValue(null);
  }

  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {value ? (
        <div className="mt-2 flex items-center justify-between rounded-md border border-white/10 p-3 text-sm">
          <span>{value}</span>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void unlink()}>
            {pending ? "Unlinking…" : "Unlink"}
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
          />
          <Button type="button" variant="secondary" disabled={pending} onClick={() => void save()}>
            {pending ? "Saving…" : "Link"}
          </Button>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
