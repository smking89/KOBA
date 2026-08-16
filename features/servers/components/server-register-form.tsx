"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DIRECTORY_GAMES } from "@/features/servers/lib/game-catalogue";
import { capabilitiesFor } from "@/features/servers/lib/capabilities";

export function ServerRegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [game, setGame] = useState(DIRECTORY_GAMES[0]!.slug);
  const [platformFamily, setPlatformFamily] = useState<"PC" | "CONSOLE">("PC");
  const [region, setRegion] = useState("");
  const [hostname, setHostname] = useState("");
  const [queryPort, setQueryPort] = useState("");
  const [tags, setTags] = useState("");
  const [joinInfo, setJoinInfo] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const caps = useMemo(() => capabilitiesFor(game, platformFamily), [game, platformFamily]);

  const gamesForPlatform = useMemo(
    () =>
      DIRECTORY_GAMES.filter(
        (g) => g.platformFamily === platformFamily || g.platformFamily === "BOTH",
      ),
    [platformFamily],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        game,
        platformFamily,
        region,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 12),
        description: description || undefined,
        joinInfo: joinInfo || undefined,
        hostname: hostname || undefined,
        queryPort: queryPort ? Number(queryPort) : undefined,
      };
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; slug?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create draft.");
        return;
      }
      router.push(`/servers/${data.slug ?? ""}`);
      router.refresh();
    } catch {
      setError("Network error — registration requires a connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardTitle>Register a server</CardTitle>
      <CardDescription>
        Saves as a draft. RCON credentials are not collected in this phase — use Manage after
        verification to prepare for Phase 14E.
      </CardDescription>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-muted">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Platform</span>
            <select
              value={platformFamily}
              onChange={(e) => {
                const next = e.target.value as "PC" | "CONSOLE";
                setPlatformFamily(next);
                const first = DIRECTORY_GAMES.find(
                  (g) => g.platformFamily === next || g.platformFamily === "BOTH",
                );
                if (first) setGame(first.slug);
              }}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="PC">PC</option>
              <option value="CONSOLE">Console</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">Game</span>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {gamesForPlatform.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="text-sm text-muted">Supported capabilities</p>
          <ul className="mt-1 flex flex-wrap gap-1 text-xs">
            {caps.map((c) => (
              <li key={c} className="rounded border border-border px-2 py-0.5">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <label className="block text-sm">
          <span className="text-muted">Region</span>
          <input
            required
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="US-East"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Hostname (public)</span>
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              placeholder="play.example.com"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Query port</span>
            <input
              value={queryPort}
              onChange={(e) => setQueryPort(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              inputMode="numeric"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-muted">Tags (comma-separated)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Join info</span>
          <input
            value={joinInfo}
            onChange={(e) => setJoinInfo(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand-gradient px-4 text-sm font-semibold text-background disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
      </form>
    </Card>
  );
}
