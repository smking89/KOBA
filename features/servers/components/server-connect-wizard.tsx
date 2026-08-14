"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/koba/status-pill";
import {
  canConnectGameServer,
  rconTestLabel,
  type RconTestState,
  type ServerCapability,
} from "@/features/servers/lib/types";

const DEMO_CAPABILITIES: ServerCapability[] = [
  "STATUS",
  "PLAYER_COUNT",
  "QUEUE_COUNT",
  "MAP_INFO",
  "RCON_READ",
  "PC",
];

export function ServerConnectWizard() {
  const { data: session, status } = useSession();
  const allowed = canConnectGameServer(session?.user.accountType);
  const [testState, setTestState] = useState<RconTestState>("IDLE");
  const [password, setPassword] = useState("");

  if (status === "loading") {
    return <p className="text-sm text-muted">Checking account…</p>;
  }

  if (!session?.user) {
    return (
      <Card>
        <CardTitle>Sign in required</CardTitle>
        <CardDescription>Business or Influencer KOBAIDs can connect servers.</CardDescription>
        <Link
          href="/login?callbackUrl=/servers/connect"
          className="mt-4 inline-block text-neon-mint"
        >
          Sign in
        </Link>
      </Card>
    );
  }

  if (!allowed) {
    return (
      <Card>
        <CardTitle>Business or Influencer only</CardTitle>
        <CardDescription>
          Active account type is {session.user.accountType ?? "unknown"}. Switch to a Business or
          Influencer KOBAID in Settings, or add that identity first.
        </CardDescription>
        <Link href="/settings" className="mt-4 inline-block text-neon-mint">
          Open settings
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servers" className="text-sm text-muted hover:text-foreground">
          ← Servers
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Connect server</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          RCON credentials are write-only in the UI. KOBA will not redisplay saved secrets. No
          administrative commands run in this phase — connection test is a stub.
        </p>
      </div>

      <Card>
        <CardTitle>Connection wizard</CardTitle>
        <CardDescription>Game, endpoint, and masked credentials.</CardDescription>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setTestState("TESTING");
            window.setTimeout(() => setTestState("SUCCESS"), 600);
          }}
        >
          <label className="space-y-1 text-sm">
            <Label htmlFor="game">Game</Label>
            <select
              id="game"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3"
              defaultValue="Rust"
            >
              <option>Rust</option>
              <option>Minecraft</option>
              <option>DayZ</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <Label htmlFor="platform">Platform</Label>
            <select
              id="platform"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3"
              defaultValue="PC"
            >
              <option>PC</option>
              <option>CONSOLE</option>
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <Label htmlFor="host">Server address</Label>
            <Input id="host" placeholder="203.0.113.10" autoComplete="off" />
          </label>
          <label className="space-y-1 text-sm">
            <Label htmlFor="port">Port</Label>
            <Input id="port" placeholder="28016" inputMode="numeric" autoComplete="off" />
          </label>
          <label className="space-y-1 text-sm">
            <Label htmlFor="rcon-pass">RCON password</Label>
            <Input
              id="rcon-pass"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" size="sm">
              Test connection
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTestState("TIMEOUT")}>
              Simulate timeout
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTestState("AUTH_FAILED")}
            >
              Simulate auth failure
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTestState("UNSUPPORTED")}
            >
              Simulate unsupported
            </Button>
            <StatusPill
              tone={
                testState === "SUCCESS"
                  ? "success"
                  : testState === "TESTING" || testState === "IDLE"
                    ? "neutral"
                    : "danger"
              }
            >
              {rconTestLabel(testState)}
            </StatusPill>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Capability summary</CardTitle>
        <CardDescription>Read-only monitoring after a successful link.</CardDescription>
        <ul className="mt-3 flex flex-wrap gap-2">
          {DEMO_CAPABILITIES.map((capability) => (
            <StatusPill key={capability} tone="accent">
              {capability}
            </StatusPill>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary">
            Rotate credentials
          </Button>
          <Button size="sm" variant="danger">
            Disconnect
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Password field length in memory: {password.length} (value never echoed back after save).
        </p>
      </Card>
    </div>
  );
}
