"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/koba/status-pill";
import type { RustIntegrationHealth, ServerCapability } from "@/features/servers/lib/types";
import { rconTestLabel, type RconTestState } from "@/features/servers/lib/types";

const CAPABILITY_LABELS: Partial<Record<ServerCapability, string>> = {
  STATUS: "Status",
  PLAYER_COUNT: "Player count",
  QUEUE_COUNT: "Queue",
  MAP_INFO: "Map",
  PING: "Ping",
  PUBLIC_QUERY: "Public query",
  RCON_READ: "RCON read-only",
  PC: "PC",
};

type PanelState = RconTestState | "CONNECTING";

function toneFor(state: PanelState) {
  if (state === "SUCCESS") return "success" as const;
  if (state === "TESTING" || state === "CONNECTING" || state === "IDLE") return "neutral" as const;
  return "danger" as const;
}

function labelFor(state: PanelState) {
  if (state === "CONNECTING") return "Connecting…";
  return rconTestLabel(state);
}

export function RustIntegrationPanel({
  serverSlug,
  serverName,
  initialHealth,
}: {
  serverSlug: string;
  serverName: string;
  initialHealth?: RustIntegrationHealth | null;
}) {
  const formId = useId();
  const [health, setHealth] = useState<RustIntegrationHealth | null>(initialHealth ?? null);
  const [hostname, setHostname] = useState(initialHealth?.hostname ?? "");
  const [queryPort, setQueryPort] = useState(String(initialHealth?.queryPort ?? 28015));
  const [rconPort, setRconPort] = useState(String(initialHealth?.rconPort ?? 28016));
  const [password, setPassword] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [state, setState] = useState<PanelState>(
    initialHealth?.credentialsConfigured ? "SUCCESS" : "IDLE",
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    return () => {
      setPassword("");
      setAccountPassword("");
    };
  }, []);

  function clearSecrets() {
    setPassword("");
    setAccountPassword("");
  }

  async function call(path: string, body: unknown) {
    const res = await fetch(path, {
      method:
        path.endsWith("/integrations/rust") &&
        (body as { action?: string })?.action === "disconnect"
          ? "DELETE"
          : "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      errorCategory?: string;
      ok?: boolean;
      state?: RconTestState;
      integration?: RustIntegrationHealth;
    };
    if (!res.ok && !data.errorCategory) {
      throw new Error(data.error ?? "Request failed.");
    }
    return { res, data };
  }

  function applyCategory(category?: string | null) {
    if (category === "TIMEOUT") setState("TIMEOUT");
    else if (category === "INVALID_CREDENTIALS") setState("AUTH_FAILED");
    else if (category === "UNSUPPORTED_SERVER") setState("UNSUPPORTED");
    else if (category) setState("AUTH_FAILED");
  }

  async function onTest(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    setState("TESTING");
    try {
      const { data } = await call(`/api/servers/${serverSlug}/integrations/rust/test`, {
        hostname,
        queryPort: Number(queryPort),
        rconPort: Number(rconPort),
        password,
      });
      if (data.ok) {
        setState("SUCCESS");
        setMessage("Read-only connection test succeeded. Credentials were not saved.");
      } else {
        applyCategory(data.errorCategory);
        setError(data.error ?? "Connection test failed.");
      }
    } catch (err) {
      setState("AUTH_FAILED");
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      clearSecrets();
      setPending(false);
    }
  }

  async function onConnect() {
    setPending(true);
    setError(null);
    setMessage(null);
    setState("CONNECTING");
    try {
      const { data } = await call(`/api/servers/${serverSlug}/integrations/rust/connect`, {
        hostname,
        queryPort: Number(queryPort),
        rconPort: Number(rconPort),
        password,
        accountPassword,
        idempotencyKey: crypto.randomUUID(),
      });
      if (data.ok && data.integration) {
        setHealth(data.integration);
        setState("SUCCESS");
        setMessage("Rust integration connected. Administrative commands stay disabled.");
      } else {
        applyCategory(data.errorCategory);
        setError(data.error ?? "Could not connect.");
      }
    } catch (err) {
      setState("AUTH_FAILED");
      setError(err instanceof Error ? err.message : "Could not connect.");
    } finally {
      clearSecrets();
      setPending(false);
    }
  }

  async function onRotate() {
    setPending(true);
    setError(null);
    setMessage(null);
    setState("TESTING");
    try {
      const { data } = await call(`/api/servers/${serverSlug}/integrations/rust/rotate`, {
        hostname,
        queryPort: Number(queryPort),
        rconPort: Number(rconPort),
        password,
        accountPassword,
        idempotencyKey: crypto.randomUUID(),
      });
      if (data.ok && data.integration) {
        setHealth(data.integration);
        setState("SUCCESS");
        setMessage("Credentials rotated. The previous password was replaced.");
      } else {
        applyCategory(data.errorCategory);
        setError(data.error ?? "Could not rotate credentials.");
      }
    } catch (err) {
      setState("AUTH_FAILED");
      setError(err instanceof Error ? err.message : "Could not rotate credentials.");
    } finally {
      clearSecrets();
      setPending(false);
    }
  }

  async function onDisconnect() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/servers/${serverSlug}/integrations/rust`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          accountPassword,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not disconnect.");
        return;
      }
      setHealth(null);
      setState("IDLE");
      setConfirmDisconnect(false);
      setMessage("Integration disconnected and credentials revoked.");
    } catch {
      setError("Could not disconnect.");
    } finally {
      clearSecrets();
      setPending(false);
    }
  }

  const configured = Boolean(health?.credentialsConfigured);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Rust PC integration</CardTitle>
          <CardDescription>
            {serverName} · read-only monitoring. Administrative RCON commands are disabled.
          </CardDescription>
        </div>
        <StatusPill tone="accent">Read-only</StatusPill>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Supported capabilities">
        {(health?.capabilities ?? Object.keys(CAPABILITY_LABELS)).map((capability) => (
          <StatusPill key={capability} tone="accent">
            {CAPABILITY_LABELS[capability as ServerCapability] ?? capability}
          </StatusPill>
        ))}
      </ul>

      {configured ? (
        <div
          className="mt-4 rounded-md border border-border bg-background/40 p-3 text-sm"
          aria-live="polite"
        >
          <p>
            <strong>Credentials configured.</strong> The saved password is never shown.
          </p>
          <p className="mt-1 text-muted">
            Last successful sync:{" "}
            {health?.lastSuccessfulAt
              ? new Date(health.lastSuccessfulAt).toLocaleString()
              : "Never"}
            {health?.freshness.isStale ? " · stale" : " · fresh"}
          </p>
          <p className="mt-1 text-muted">
            Players: {health?.livePlayers ?? "—"} / {health?.maxPlayers ?? "—"}
            {health?.queue != null ? ` · queue ${health.queue}` : ""}
            {health?.mapName ? ` · ${health.mapName}` : ""}
          </p>
        </div>
      ) : null}

      <form id={formId} className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onTest}>
        <div className="space-y-1 text-sm sm:col-span-2">
          <Label htmlFor={`${formId}-host`}>Host</Label>
          <Input
            id={`${formId}-host`}
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            autoComplete="off"
            placeholder="play.example.com"
            required
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor={`${formId}-query`}>Query port</Label>
          <Input
            id={`${formId}-query`}
            value={queryPort}
            onChange={(event) => setQueryPort(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor={`${formId}-rcon`}>RCON port</Label>
          <Input
            id={`${formId}-rcon`}
            value={rconPort}
            onChange={(event) => setRconPort(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor={`${formId}-pass`}>RCON password</Label>
          <Input
            id={`${formId}-pass`}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={configured ? "Enter a new password to rotate" : "••••••••"}
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor={`${formId}-account`}>Account password</Label>
          <Input
            id={`${formId}-account`}
            type="password"
            value={accountPassword}
            onChange={(event) => setAccountPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Required to save, rotate, or disconnect"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending || !password}>
            Test connection
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || !password}
            onClick={onConnect}
          >
            Connect
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending || !configured || !password}
            onClick={onRotate}
          >
            Rotate credentials
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={pending || !configured}
            onClick={() => setConfirmDisconnect(true)}
          >
            Disconnect
          </Button>
          <StatusPill tone={toneFor(state)}>{labelFor(state)}</StatusPill>
        </div>
      </form>

      {confirmDisconnect ? (
        <div
          className="mt-3 rounded-md border border-destructive/40 p-3 text-sm"
          role="alertdialog"
          aria-label="Confirm disconnect"
        >
          <p>Disconnect and revoke stored credentials? This cannot be undone.</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending || !accountPassword}
              onClick={onDisconnect}
            >
              Confirm disconnect
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDisconnect(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted">
        Kick, ban, give, teleport, map change, restart, and arbitrary console commands are not
        available.
      </p>
      <div aria-live="polite">
        {message ? <p className="mt-2 text-sm text-neon-mint">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
    </Card>
  );
}
