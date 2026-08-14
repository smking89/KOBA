"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!deferred || dismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Install KOBA"
      className="fixed right-4 bottom-20 left-4 z-50 md:bottom-6 md:left-auto md:max-w-sm"
    >
      <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
        <p className="text-sm font-semibold">Install KOBA</p>
        <p className="mt-1 text-xs text-muted">
          Add KOBA to your home screen for faster access to market, groups, and LFG.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
          >
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Not now
          </Button>
        </div>
      </div>
    </aside>
  );
}
