"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import {
  AIDEN_ASSET_TYPES,
  AIDEN_DISCLAIMER,
  aidenAssetTypeLabel,
  aidenJobLabel,
  type AidenAssetType,
  type AidenJobView,
} from "@/features/aiden/lib/types";
import { coinCostForAssetType } from "@/features/aiden/lib/cost-preview";

const GAMES = ["Rust", "Minecraft", "ARK: SA"] as const;
const PLATFORMS = ["STEAM", "PC", "XBOX"] as const;

export function AidenGenerateWorkspace({ initialJobs = [] }: { initialJobs?: AidenJobView[] }) {
  const router = useRouter();
  const [assetType, setAssetType] = useState<AidenAssetType>("CONCEPT_IMAGE");
  const [prompt, setPrompt] = useState("");
  const [game, setGame] = useState<string>(GAMES[0]);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const costPreview = coinCostForAssetType(assetType);

  async function submit() {
    setBusy(true);
    setError(null);

    const response = await fetch("/api/aiden/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, game, platform, assetType }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not queue generation.");
      return;
    }

    setPrompt("");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/aiden" className="text-sm text-muted hover:text-foreground">
          ← Aiden
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Generator</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
      </div>

      <Card>
        <CardTitle>Prompt composer</CardTitle>
        <CardDescription>
          Routed through Aiden Studio OS to the matching Vest/Graft/Terra provider — see the
          job&apos;s status below once queued.
        </CardDescription>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Describe the asset…"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Game</span>
            <select
              value={game}
              onChange={(event) => setGame(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3"
            >
              {GAMES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Platform</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3"
            >
              {PLATFORMS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Asset type</span>
            <select
              value={assetType}
              onChange={(event) => setAssetType(event.target.value as AidenAssetType)}
              className="h-10 w-full rounded-md border border-border bg-background px-3"
            >
              {AIDEN_ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {aidenAssetTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-sm">
          Cost: <span className="font-mono text-neon-lime">{costPreview} KOBA Coins</span> (reserved
          on submit, captured on success, released if generation fails)
        </p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <Button
          className="mt-4"
          size="sm"
          disabled={!prompt.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? "Queuing…" : "Queue generation"}
        </Button>
      </Card>

      <Card>
        <CardTitle>Generation history</CardTitle>
        <ul className="mt-4 space-y-3">
          {initialJobs.length === 0 ? (
            <li className="text-sm text-muted">No generation jobs yet.</li>
          ) : (
            initialJobs.map((job) => (
              <li
                key={job.publicRef}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-xs text-neon-mint">{job.publicRef}</p>
                  <p className="text-sm">{job.prompt}</p>
                  <p className="text-xs text-muted">
                    {job.game} · {aidenAssetTypeLabel(job.assetType)} ·{" "}
                    {job.coinCostActual ?? job.coinCostPreview} Coins
                    {job.coinCostActual !== null && job.coinCostActual !== job.coinCostPreview
                      ? ` (preview: ${job.coinCostPreview})`
                      : ""}
                  </p>
                  {job.state === "FAILED" && job.failureReason ? (
                    <p className="mt-1 text-xs text-destructive">{job.failureReason}</p>
                  ) : null}
                </div>
                <StatusPill
                  tone={
                    job.state === "COMPLETED"
                      ? "success"
                      : job.state === "FAILED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {aidenJobLabel(job.state)}
                </StatusPill>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
