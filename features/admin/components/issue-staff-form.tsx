"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IssueStaffForm({ canIssue }: { canIssue: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<"SUPERADMIN" | "ADMIN" | "MODERATOR">("MODERATOR");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canIssue) {
    return (
      <p className="text-sm text-muted">
        Only Superadmin (or Admin for Moderators) can issue staff KOBAIDs.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/kobaid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, accountType }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      accountType?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Could not issue staff KOBAID.");
      return;
    }
    setMessage(`Issued ${payload.code} (${payload.accountType}).`);
    setEmail("");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-neon-mint">{message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="staff-email">Target email</Label>
        <Input
          id="staff-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-type">Staff type</Label>
        <select
          id="staff-type"
          className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
          value={accountType}
          onChange={(event) =>
            setAccountType(event.target.value as "SUPERADMIN" | "ADMIN" | "MODERATOR")
          }
        >
          <option value="MODERATOR">Moderator (MD)</option>
          <option value="ADMIN">Admin (AD)</option>
          <option value="SUPERADMIN">Superadmin (SA)</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Issue staff KOBAID
      </Button>
    </form>
  );
}
