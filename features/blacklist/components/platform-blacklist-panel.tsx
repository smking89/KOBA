"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TargetSearchInput, type TargetCandidate } from "@/features/blacklist/components/target-search-input";

type PlatformBlacklistEntry = {
  id: string;
  targetType: "USER" | "SHOP";
  reason: string;
  hashtags: string[];
  requestSocialRemoval: boolean;
  createdAt: string;
  targetUser: { id: string; email: string; profile: { handle: string | null; displayName: string | null } | null } | null;
  targetShop: { id: string; name: string; slug: string } | null;
};

export function PlatformBlacklistPanel({ initialEntries }: { initialEntries: PlatformBlacklistEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [targetType, setTargetType] = useState<"USER" | "SHOP">("USER");
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
      setError("Search for a target first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId: target.id,
          reason,
          hashtags: hashtags
            .split(/[\s,]+/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          requestSocialRemoval,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        entry?: PlatformBlacklistEntry;
      };
      if (!response.ok || !payload.entry) {
        setError(payload.error ?? "Could not issue ban.");
        return;
      }
      setEntries((prev) => [payload.entry as PlatformBlacklistEntry, ...prev]);
      setTarget(null);
      setReason("");
      setHashtags("");
      setRequestSocialRemoval(false);
    });
  }

  function remove(entryId: string) {
    setRemovingId(entryId);
    startTransition(async () => {
      const response = await fetch(`/api/admin/blacklist/${entryId}`, { method: "DELETE" });
      setRemovingId(null);
      if (!response.ok) return;
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    });
  }

  const visibleEntries = filter
    ? entries.filter((entry) => {
        const needle = filter.replace(/^@/, "").toLowerCase();
        const handle = entry.targetUser?.profile?.handle?.toLowerCase() ?? "";
        const shopName = entry.targetShop?.name?.toLowerCase() ?? "";
        return handle.includes(needle) || shopName.includes(needle);
      })
    : entries;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-white/10 p-4">
        <p className="text-sm font-medium">Issue a platform ban</p>
        <p className="text-xs text-muted">
          Full account lockout — the target can&apos;t sign in at all until this is lifted.
        </p>

        <div className="flex gap-2">
          {(["USER", "SHOP"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setTargetType(type);
                setTarget(null);
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold",
                targetType === type
                  ? "border-neon-lime bg-neon-lime/10 text-neon-lime"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {type === "USER" ? "Ban a user" : "Ban a shop"}
            </button>
          ))}
        </div>

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
            searchUrl={(q) =>
              `/api/admin/blacklist/search?targetType=${targetType}&q=${encodeURIComponent(q)}`
            }
            placeholder={targetType === "USER" ? "@username, KOBAID, or shop name" : "shop name"}
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
          Also flag for removal from connected socials — a manual step today, KOBA doesn&apos;t
          auto-kick yet.
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" variant="danger" onClick={submit} disabled={pending}>
          {pending ? "Issuing…" : "Issue ban"}
        </Button>
      </div>

      <div className="space-y-3">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search bans by @username or shop name"
        />
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-muted">No platform bans yet.</p>
        ) : (
          <ul className="space-y-2">
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="rounded-md border border-white/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {entry.targetType === "USER"
                        ? `@${entry.targetUser?.profile?.handle ?? entry.targetUser?.email}`
                        : `Shop: ${entry.targetShop?.name}`}
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
                    {removingId === entry.id ? "Lifting…" : "Lift ban"}
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
