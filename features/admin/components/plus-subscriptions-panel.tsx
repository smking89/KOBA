"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/dashboard/data-table";

type AdminPlusRow = {
  publicRef: string | null;
  state: string;
  planCode: string | null;
  accountType: string;
  kobaId: string;
  email: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  lastStripeEventId: string | null;
};

export function PlusSubscriptionsPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminPlusRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/plus?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { error?: string; subscriptions?: AdminPlusRow[] };
      if (!response.ok) {
        setError(payload.error ?? "Could not search subscriptions.");
        return;
      }
      setRows(payload.subscriptions ?? []);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(publicRef: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/plus/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ publicRef }),
      });
      const payload = (await response.json()) as {
        error?: string;
        aligned?: boolean;
        state?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Could not reconcile.");
        return;
      }
      setMessage(
        payload.aligned
          ? `${publicRef} already matched Stripe (${payload.state}).`
          : `${publicRef} updated from Stripe to ${payload.state}.`,
      );
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Read-only search and Stripe → local reconcile. Staff cannot mark a subscription Active.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-neon-mint">{message}</p> : null}
      <form onSubmit={(event) => void search(event)} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="plus-search">Search ref, KOBAID, email, or Stripe id</Label>
          <Input
            id="plus-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={busy}>
          Search
        </Button>
      </form>
      <DataTable>
        <DataTableHead>
          <DataTableTh>Subscription</DataTableTh>
          <DataTableTh>State</DataTableTh>
          <DataTableTh>Account</DataTableTh>
          <DataTableTh>Stripe</DataTableTh>
          <DataTableTh className="text-right">Action</DataTableTh>
        </DataTableHead>
        <DataTableBody>
          {rows.length === 0 ? (
            <DataTableEmpty colSpan={5}>No subscriptions loaded.</DataTableEmpty>
          ) : (
            rows.map((row) => (
              <DataTableRow key={row.publicRef ?? row.kobaId}>
                <DataTableTd className="font-mono text-xs text-foreground">
                  {row.publicRef ?? "—"}
                </DataTableTd>
                <DataTableTd>
                  <Badge tone={row.state === "ACTIVE" ? "live" : "default"}>{row.state}</Badge>
                  {row.cancelAtPeriodEnd ? (
                    <span className="ml-2 text-xs text-muted">cancels at period end</span>
                  ) : null}
                </DataTableTd>
                <DataTableTd className="text-xs text-muted">
                  {row.planCode ? `${row.planCode} · ` : ""}
                  {row.accountType} · {row.kobaId}
                  {row.email ? <div>{row.email}</div> : null}
                </DataTableTd>
                <DataTableTd className="font-mono text-xs text-muted">
                  sub {row.stripeSubscriptionId ?? "—"}
                  <div>event {row.lastStripeEventId ?? "—"}</div>
                </DataTableTd>
                <DataTableTd className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy || !row.publicRef}
                    onClick={() => row.publicRef && void reconcile(row.publicRef)}
                  >
                    Reconcile
                  </Button>
                </DataTableTd>
              </DataTableRow>
            ))
          )}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
