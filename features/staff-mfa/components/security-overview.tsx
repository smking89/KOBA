"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaffPasswordChangeForm } from "@/features/staff-mfa/components/password-change-form";

type Status = {
  staff?: boolean;
  enrolled?: boolean;
  remainingRecoveryCodes?: number;
  aal?: "AAL1" | "AAL2";
  stepUpFresh?: boolean;
  confirmedAt?: string | null;
};

type EventRow = { id: string; action: string; createdAt: string };

export function SecurityOverview() {
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    void fetch("/api/staff-mfa/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Status) => setStatus(data));
    void fetch("/api/staff-mfa/events", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { events: [] }))
      .then((data: { events?: EventRow[] }) => setEvents(data.events ?? []));
  }, []);

  if (!status?.staff) {
    return (
      <Card>
        <CardTitle>Account security</CardTitle>
        <CardDescription>
          Staff MFA controls apply only to KOBA staff identities. Use password reset for your public
          account.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Staff MFA</CardTitle>
          <Badge tone={status.enrolled ? "success" : "warning"}>
            {status.enrolled ? "Enabled" : "Required"}
          </Badge>
          <Badge>{status.aal ?? "AAL1"}</Badge>
        </div>
        <CardDescription>
          Privileged staff access requires password plus authenticator (AAL2). Public account
          switching does not grant staff authorization.
        </CardDescription>
        <p className="text-sm text-muted">
          Recovery codes remaining: {status.remainingRecoveryCodes ?? 0}
          {status.confirmedAt
            ? ` · Enrolled ${new Date(status.confirmedAt).toLocaleString()}`
            : null}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/settings/security/mfa" className="text-neon-lime hover:underline">
            {status.enrolled ? "Manage MFA" : "Enroll MFA"}
          </Link>
          <Link href="/settings/security/sessions" className="text-neon-lime hover:underline">
            Sessions
          </Link>
          <Link href="/forgot-password" className="text-neon-lime hover:underline">
            Reset password by email
          </Link>
        </div>
      </Card>
      <StaffPasswordChangeForm enrolled={Boolean(status.enrolled)} />
      <Card>
        <CardTitle>Recent security events</CardTitle>
        <ul className="mt-4 space-y-2 font-mono text-xs text-muted">
          {events.length === 0 ? (
            <li>No recent staff security events.</li>
          ) : (
            events.map((event) => (
              <li key={event.id}>
                <span className="text-foreground">{event.action}</span>
                <span className="ml-2">{new Date(event.createdAt).toLocaleString()}</span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
