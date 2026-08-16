"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";

export function MfaEnrollForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/staff-mfa/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { enrolled?: boolean }) => setEnrolled(Boolean(data.enrolled)));
  }, []);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff-mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as {
        error?: string;
        secret?: string;
        qrDataUrl?: string;
      };
      if (!response.ok || !data.secret) {
        setError(data.error ?? "Could not start enrollment.");
        setBusy(false);
        return;
      }
      setSecret(data.secret);
      setQr(data.qrDataUrl ?? null);
      setPassword("");
    } catch {
      setError("Could not start enrollment.");
    }
    setBusy(false);
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff-mfa/enroll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string; recoveryCodes?: string[] };
      if (!response.ok || !data.recoveryCodes) {
        setError(data.error ?? "Invalid authentication code.");
        setBusy(false);
        return;
      }
      setRecovery(data.recoveryCodes);
      setSecret(null);
      setQr(null);
    } catch {
      setError("Could not confirm enrollment.");
    }
    setBusy(false);
  }

  async function regenerate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff-mfa/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ password, code }),
      });
      const data = (await response.json()) as { error?: string; recoveryCodes?: string[] };
      if (!response.ok || !data.recoveryCodes) {
        setError(data.error ?? "Could not regenerate codes.");
        setBusy(false);
        return;
      }
      setRecovery(data.recoveryCodes);
    } catch {
      setError("Could not regenerate codes.");
    }
    setBusy(false);
  }

  async function disable() {
    if (!window.confirm("Disable staff MFA? Privileged sessions will be revoked.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff-mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ password, code, confirm: true }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not disable MFA.");
        setBusy(false);
        return;
      }
      setEnrolled(false);
      setPassword("");
      setCode("");
    } catch {
      setError("Could not disable MFA.");
    }
    setBusy(false);
  }

  if (recovery) {
    return (
      <Card className="space-y-4">
        <CardTitle>Save these recovery codes</CardTitle>
        <CardDescription>
          They are shown once. Store them offline. Each code works only one time.
        </CardDescription>
        <ul className="grid gap-2 font-mono text-sm sm:grid-cols-2">
          {recovery.map((item) => (
            <li key={item} className="rounded-md border border-border bg-surface px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(recovery.join("\n"));
          }}
        >
          Copy codes
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const blob = new Blob([recovery.join("\n")], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "koba-staff-recovery-codes.txt";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download codes
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            router.push("/admin");
            router.refresh();
          }}
        >
          Continue to staff
        </Button>
      </Card>
    );
  }

  if (enrolled && !secret) {
    return (
      <Card className="space-y-4">
        <CardTitle>Staff MFA is enabled</CardTitle>
        <CardDescription>
          Regenerating recovery codes requires your password and a current authenticator code.
          Disabling MFA also revokes privileged sessions and requires enrollment before staff access
          returns.
        </CardDescription>
        {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
        <form onSubmit={regenerate} className="space-y-3">
          <FormField id="password" label="Current password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>
          <FormField id="code" label="Authenticator code">
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              Regenerate recovery codes
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void disable()}>
              Disable MFA
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  if (secret) {
    return (
      <Card className="space-y-4">
        <CardTitle>Confirm authenticator</CardTitle>
        <CardDescription>
          Scan the QR code or enter the setup key in an authenticator app, then enter a 6-digit
          code. The secret is not stored in the browser after you leave this page.
        </CardDescription>
        {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Authenticator QR code" width={240} height={240} className="mx-auto" />
        ) : null}
        <p className="break-all font-mono text-xs text-muted">{secret}</p>
        <form onSubmit={confirm} className="space-y-3">
          <FormField id="code" label="6-digit code">
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </FormField>
          <Button type="submit" disabled={busy}>
            {busy ? "Confirming…" : "Activate MFA"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <CardTitle>Enroll staff MFA</CardTitle>
      <CardDescription>
        Staff accounts must use an authenticator app. Confirm your password to generate a new
        secret. SMS is not supported.
      </CardDescription>
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      <form onSubmit={start} className="space-y-3">
        <FormField id="password" label="Current password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? "Starting…" : "Generate authenticator key"}
        </Button>
      </form>
    </Card>
  );
}
