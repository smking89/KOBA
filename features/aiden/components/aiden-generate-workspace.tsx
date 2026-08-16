"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/koba/status-pill";
import {
  AIDEN_DISCLAIMER,
  aidenAssetTypeLabel,
  aidenJobLabel,
  type AidenJobView,
} from "@/features/aiden/lib/types";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `aiden-${Date.now()}`;
}

export function AidenGenerateWorkspace({ initialJobs = [] }: { initialJobs?: AidenJobView[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [game, setGame] = useState("Rust");
  const [platform, setPlatform] = useState("STEAM");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [estimate, setEstimate] = useState<string>("40");
  const [available, setAvailable] = useState<string | null>(null);
  const [reserved, setReserved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState(initialJobs);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/aiden/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ assetType: "CONCEPT_IMAGE", quality }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          estimate?: { estimatedCostCoins?: string };
          wallet?: { available?: string; reserved?: string };
        };
        if (cancelled || !response.ok) return;
        if (payload.estimate?.estimatedCostCoins) setEstimate(payload.estimate.estimatedCostCoins);
        if (payload.wallet?.available) setAvailable(payload.wallet.available);
        if (payload.wallet?.reserved) setReserved(payload.wallet.reserved);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [quality]);

  async function queueJob() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/aiden/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          prompt,
          game,
          platform,
          assetType: "CONCEPT_IMAGE",
          quality,
          idempotencyKey: newKey(),
        }),
      });
      const payload = (await response.json()) as AidenJobView & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not queue generation.");
        return;
      }
      router.push(`/aiden/jobs/${payload.publicRef}`);
    } catch {
      setError("Network error. Generation requires internet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/aiden" className="text-sm text-muted hover:text-foreground">
          ← Aiden
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create concept image</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
      </div>

      <Card>
        <CardTitle>Concept image</CardTitle>
        <CardDescription>
          Only concept-image generation is active. Output is a private draft, never a game-ready
          listing.
        </CardDescription>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted">Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              maxLength={2000}
              aria-label="Prompt"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Describe the concept image…"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Game context</span>
            <Input value={game} onChange={(event) => setGame(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Platform</span>
            <Input value={platform} onChange={(event) => setPlatform(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Quality</span>
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value as "standard" | "hd")}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="hd">HD</option>
            </select>
          </label>
        </div>
        <p className="mt-4 text-sm">
          Estimated cost: <span className="font-mono text-neon-lime">{estimate} KOBA Coins</span>
        </p>
        {available != null ? (
          <p className="mt-1 text-xs text-muted">
            Wallet available {available}
            {reserved ? ` · reserved ${reserved}` : ""}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button
          className="mt-4"
          size="sm"
          disabled={!prompt.trim() || busy}
          onClick={() => void queueJob()}
        >
          {busy ? "Queuing…" : "Confirm and queue"}
        </Button>
      </Card>

      <Card>
        <CardTitle>Generation history</CardTitle>
        <ul className="mt-4 space-y-3">
          {jobs.length === 0 ? (
            <li className="text-sm text-muted">No generation jobs yet.</li>
          ) : (
            jobs.map((job) => (
              <li
                key={job.publicRef}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/aiden/jobs/${job.publicRef}`}
                    className="font-mono text-xs text-neon-mint hover:underline"
                  >
                    {job.publicRef}
                  </Link>
                  <p className="text-sm">{job.prompt}</p>
                  <p className="text-xs text-muted">
                    {job.game} · {aidenAssetTypeLabel(job.assetType)} · {job.estimatedCostCoins}{" "}
                    Coins
                    {job.coinCostActual != null && job.coinCostActual !== job.coinCostPreview
                      ? ` (actual: ${job.coinCostActual})`
                      : ""}
                  </p>
                  {job.state === "FAILED" && job.failureReason ? (
                    <p className="mt-1 text-xs text-destructive">{job.failureReason}</p>
                  ) : null}
                </div>
                <StatusPill
                  tone={
                    job.state === "SUCCEEDED" || job.state === "COMPLETED"
                      ? "success"
                      : job.state === "FAILED" || job.state === "CANCELLED"
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
