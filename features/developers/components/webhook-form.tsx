"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretReveal } from "@/features/developers/components/developer-forms";

export function CreateWebhookForm() {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const events = form.getAll("events");
    const response = await fetch("/api/developers/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ url: form.get("url"), events }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      secret?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Could not create webhook.");
      return;
    }
    setSecret(payload.secret ?? null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {secret ? <SecretReveal label="Webhook signing secret" secret={secret} /> : null}
      <div className="space-y-2">
        <Label htmlFor="url">HTTPS endpoint</Label>
        <Input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://example.com/koba-webhooks"
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm">Events</legend>
        {[
          "order.created",
          "order.completed",
          "order.refunded",
          "product.updated",
          "server.status_changed",
        ].map((eventName) => (
          <label key={eventName} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="events" value={eventName} className="accent-[#B8FF00]" />
            <span className="font-mono">{eventName}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit">Register webhook</Button>
    </form>
  );
}
