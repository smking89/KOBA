"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TargetSearchInput, type TargetCandidate } from "@/features/blacklist/components/target-search-input";

type BlacklistEntry = {
  id: string;
  reason: string;
  hashtags: string[];
  requestSocialRemoval: boolean;
  createdAt: string;
  targetUser: { id: string; email: string; profile: { handle: string | null; displayName: string | null } | null };
};

export function ShopBlacklistPanel({ initialEntries }: { initialEntries: BlacklistEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [target, setTarget] = useState<TargetCandidate | null>(null);
  const [reason, setReason] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [requestSocialRemoval, setRequestSocialRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  function submit() {
    if (!target) {
      setError("Search for a user to blacklist first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/business/blacklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId: target.id,
          reason,
          hashtags: hashtags
            .split(/[\s,]+/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          requestSocialRemoval,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; entry?: BlacklistEntry };
      if (!response.ok || !payload.entry) {
        setError(payload.error ?? "Could not add to blacklist.");
        return;
      }
      setEntries((prev) => [payload.entry as BlacklistEntry, ...prev]);
      setTarget(null);
      setReason("");
      setHashtags("");
      setRequestSocialRemoval(false);
    });
  }

  function remove(entryId: string) {
    setRemovingId(entryId);
    startTransition(async () => {
      const response = await fetch(`/api/business/blacklist/${entryId}`, { method: "DELETE" });
      setRemovingId(null);
      if (!response.ok) return;
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    });
  }

  const visibleEntries = filter
    ? entries.filter((entry) => {
        const handle = entry.targetUser.profile?.handle?.toLowerCase() ?? "";
        return handle.includes(filter.replace(/^@/, "").toLowerCase());
      })
    : entries;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-white/10 p-4">
        <p className="text-sm font-medium">Add to blacklist</p>
        {target ? (
          <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm">
            <span>
              {target.label} <span className="text-muted">· {target.sublabel}</span>
            </span>
            <button type="button" className="text-muted hover:text-foreground" onClick={() => setTarget(null)}>
              Change
            </button>
          </div>
        ) : (
          <TargetSearchInput
            searchUrl={(q) => `/api/business/blacklist/search?q=${encodeURIComponent(q)}`}
            placeholder="@username or shop name"
            onSelect={setTarget}
          />
        )}
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (required, kept internal)"
          rows={2}
        />
        <Input
          value={hashtags}
          onChange={(event) => setHashtags(event.target.value)}
          placeholder="#chargeback #cheating (space or comma separated)"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={requestSocialRemoval}
            onChange={(event) => setRequestSocialRemoval(event.target.checked)}
            className="accent-neon-lime"
          />
          Also flag for removal from connected socials (Discord, etc.) — a manual step today, KOBA
          doesn&apos;t auto-kick yet.
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Adding…" : "Add to blacklist"}
        </Button>
      </div>

      <div className="space-y-3">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search blacklist by @username"
        />
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-muted">Nobody on this shop&apos;s blacklist yet.</p>
        ) : (
          <ul className="space-y-2">
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="rounded-md border border-white/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      @{entry.targetUser.profile?.handle ?? entry.targetUser.email}
                    </p>
                    <p className="mt-1 text-muted">{entry.reason}</p>
                    {entry.hashtags.length > 0 ? (
                      <p className="mt-1 text-xs text-muted">
                        {entry.hashtags.map((tag) => `#${tag}`).join(" ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removingId === entry.id}
                    onClick={() => remove(entry.id)}
                  >
                    {removingId === entry.id ? "Removing…" : "Remove"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
