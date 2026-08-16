"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { FormField } from "@/features/auth/components/form-field";

export function StaffPasswordChangeForm({ enrolled }: { enrolled: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff-mfa/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          ...(enrolled ? { code } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not change password.");
        setBusy(false);
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setCode("");
    } catch {
      setError("Could not change password.");
    }
    setBusy(false);
  }

  return (
    <Card className="space-y-3">
      <CardTitle>Change password</CardTitle>
      <CardDescription>
        Changing your password signs out every privileged staff session. If MFA is enabled, a
        current authenticator code is required.
      </CardDescription>
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      {done ? (
        <AuthAlert variant="success">Password changed. Sign in again with MFA.</AuthAlert>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="current-password" label="Current password">
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </FormField>
        <FormField id="new-password" label="New password">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </FormField>
        {enrolled ? (
          <FormField id="password-totp" label="Authenticator code">
            <Input
              id="password-totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </FormField>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Updating…" : "Change password"}
        </Button>
      </form>
    </Card>
  );
}
