"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type PlatformFunctionRow = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  note: string | null;
  updatedAt: string | null;
};

export function PlatformFunctionsPanel({
  initialFunctions,
}: {
  initialFunctions: PlatformFunctionRow[];
}) {
  const [functions, setFunctions] = useState(initialFunctions);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(key: string, nextEnabled: boolean) {
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const response = await fetch(`/api/admin/platform-functions/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        function?: PlatformFunctionRow;
      };
      setPendingKey(null);
      if (!response.ok || !payload.function) {
        setError(payload.error ?? "Could not update platform function.");
        return;
      }
      const updated = payload.function;
      setFunctions((prev) => prev.map((fn) => (fn.key === updated.key ? updated : fn)));
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border/60">
        {functions.map((fn) => (
          <li key={fn.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">
                {fn.label}{" "}
                <span
                  className={
                    fn.enabled
                      ? "ml-2 rounded-full bg-neon-mint/15 px-2 py-0.5 text-xs text-neon-mint"
                      : "ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive"
                  }
                >
                  {fn.enabled ? "Enabled" : "Disabled"}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">{fn.description}</p>
              {fn.updatedAt ? (
                <p className="mt-1 text-xs text-muted">
                  Last changed {new Date(fn.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant={fn.enabled ? "danger" : "secondary"}
              disabled={pendingKey === fn.key}
              onClick={() => toggle(fn.key, !fn.enabled)}
            >
              {pendingKey === fn.key ? "Saving…" : fn.enabled ? "Disable" : "Enable"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
