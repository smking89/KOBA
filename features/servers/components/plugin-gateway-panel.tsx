"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Method B (client, 2026-08-18): lets the seller switch a server
 * between KOBA dialing out over RCON (existing channel) and their own
 * plugin polling KOBA for pending commands, authenticated with a
 * rotatable HMAC key shown exactly once. Both fields PATCH the same
 * /api/servers/[slug] route ServerManagePanel's other actions already
 * use — deliveryMethod is just one more field on updateServerSchema.
 */
export function PluginGatewayPanel({
  slug,
  deliveryMethod,
}: {
  slug: string;
  deliveryMethod: "RCON" | "PLUGIN_API";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  async function setMethod(next: "RCON" | "PLUGIN_API") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/servers/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryMethod: next }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not switch delivery method.");
      return;
    }
    router.refresh();
  }

  async function rotateKey() {
    setPending(true);
    setError(null);
    setRevealedSecret(null);
    const res = await fetch(`/api/servers/${slug}/plugin-key`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { secret?: string; error?: string };
    setPending(false);
    if (!res.ok || !data.secret) {
      setError(data.error ?? "Could not rotate the plugin key.");
      return;
    }
    setRevealedSecret(data.secret);
  }

  return (
    <div className="mt-4 rounded-md border border-border p-4">
      <p className="text-sm font-medium">Delivery method</p>
      <p className="mt-1 text-xs text-muted">
        RCON — KOBA dials out with your stored credentials. Plugin — your own Oxide/Spigot-style
        plugin polls KOBA for pending commands instead, signed with a key only you have.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending || deliveryMethod === "RCON"}
          onClick={() => setMethod("RCON")}
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          RCON
        </button>
        <button
          type="button"
          disabled={pending || deliveryMethod === "PLUGIN_API"}
          onClick={() => setMethod("PLUGIN_API")}
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Plugin
        </button>
      </div>
      {deliveryMethod === "PLUGIN_API" ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void rotateKey()}
            className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
          >
            {pending ? "Rotating…" : "Rotate plugin API key"}
          </button>
          {revealedSecret ? (
            <div className="rounded-md border border-neon-mint/40 bg-surface-2 p-3">
              <p className="text-xs text-muted">
                Shown once — paste this into your plugin config now:
              </p>
              <p className="mt-1 font-mono text-xs break-all">{revealedSecret}</p>
              <p className="mt-2 font-mono text-xs text-muted">
                GET /api/gateway/v1/servers/{slug}/commands
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
