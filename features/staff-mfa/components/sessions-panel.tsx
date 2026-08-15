"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SessionRow = {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  lastMfaAt: string;
  expiresAt: string;
  ipHint: string | null;
  userAgent: string | null;
};

export function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/staff-mfa/sessions", { cache: "no-store" });
    const data = (await response.json()) as { sessions?: SessionRow[] };
    setSessions(data.sessions ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function revoke(id: string) {
    await fetch(`/api/staff-mfa/sessions/${id}`, { method: "DELETE", cache: "no-store" });
    setMessage("Session revoked.");
    await refresh();
  }

  async function revokeOthers() {
    await fetch("/api/staff-mfa/sessions?all=1", { method: "DELETE", cache: "no-store" });
    setMessage("Other staff sessions were signed out.");
    await refresh();
  }

  return (
    <Card className="space-y-4">
      <CardTitle>Privileged sessions</CardTitle>
      <CardDescription>
        These are AAL2 staff elevations, not your public KOBA login. IP addresses are shown as a
        short privacy hash only.
      </CardDescription>
      {message ? <p className="text-sm text-neon-lime">{message}</p> : null}
      <Button type="button" variant="ghost" onClick={() => void revokeOthers()}>
        Sign out other devices
      </Button>
      <ul className="space-y-3">
        {sessions.length === 0 ? (
          <li className="text-sm text-muted">No active privileged sessions.</li>
        ) : (
          sessions.map((row) => (
            <li key={row.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">
                {row.current ? "This device" : "Other device"}
                {row.userAgent ? ` · ${row.userAgent}` : ""}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">
                last MFA {new Date(row.lastMfaAt).toLocaleString()} · seen{" "}
                {new Date(row.lastSeenAt).toLocaleString()}
                {row.ipHint ? ` · net ${row.ipHint}` : ""}
              </p>
              {row.current ? null : (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  variant="ghost"
                  onClick={() => void revoke(row.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
