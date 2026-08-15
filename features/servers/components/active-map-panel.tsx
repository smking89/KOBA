"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type OwnedMap = { publicRef: string; title: string; rarity: string };

export function ActiveMapPanel({
  serverSlug,
  isOwner,
  activeMapTitle,
  activeMapRarity,
}: {
  serverSlug: string;
  isOwner: boolean;
  activeMapTitle: string | null;
  activeMapRarity: string | null;
}) {
  const [maps, setMaps] = useState<OwnedMap[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(activeMapTitle);
  const [rarity, setRarity] = useState(activeMapRarity);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOwner || loaded) return;
    fetch(`/api/servers/${serverSlug}/active-map`)
      .then((res) => res.json())
      .then((payload: { maps?: OwnedMap[] }) => {
        setMaps(payload.maps ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [isOwner, loaded, serverSlug]);

  async function apply() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/servers/${serverSlug}/active-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryItemPublicRef: selected }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      activeMapTitle?: string;
      activeMapRarity?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not set active map.");
      return;
    }
    setTitle(payload.activeMapTitle ?? null);
    setRarity(payload.activeMapRarity ?? null);
  }

  async function clear() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/servers/${serverSlug}/active-map`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      setError("Could not clear active map.");
      return;
    }
    setTitle(null);
    setRarity(null);
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-sm">
        {title && rarity ? (
          <>
            <span className="font-medium">{title}</span>{" "}
            <span className="text-muted">({rarity})</span>
          </>
        ) : (
          <span className="text-muted">No active map set.</span>
        )}
      </p>
      {isOwner ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-border bg-surface-2 px-2 text-sm"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">
              {maps.length === 0 ? "No owned Maps" : "Choose a Map you own"}
            </option>
            {maps.map((map) => (
              <option key={map.publicRef} value={map.publicRef}>
                {map.title} ({map.rarity})
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={busy || !selected} onClick={() => void apply()}>
            Set active
          </Button>
          {title ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void clear()}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
