"use client";

import Link from "next/link";
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

export function AidenGenerateWorkspace({
  initialJobs = [],
}: {
  initialJobs?: AidenJobView[];
}) {
  const [assetType, setAssetType] = useState<AidenAssetType>("CONCEPT_IMAGE");
  const [prompt, setPrompt] = useState("");
  const costPreview = assetType === "MAP" || assetType === "TERRAIN" ? 120 : 40;

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
        <CardDescription>No AI provider is called in this phase.</CardDescription>
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
            <select className="h-10 w-full rounded-md border border-border bg-background px-3">
              <option>Rust</option>
              <option>Minecraft</option>
              <option>ARK: SA</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Platform</span>
            <select className="h-10 w-full rounded-md border border-border bg-background px-3">
              <option>STEAM</option>
              <option>PC</option>
              <option>XBOX</option>
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
          Cost preview: <span className="font-mono text-neon-lime">{costPreview} KOBA Coins</span>{" "}
          (placeholder)
        </p>
        <Button className="mt-4" size="sm" disabled={!prompt.trim()}>
          Queue generation
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
                    {job.game} · {aidenAssetTypeLabel(job.assetType)} · {job.coinCostPreview} Coins
                  </p>
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
