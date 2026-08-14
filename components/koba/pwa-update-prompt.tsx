"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const listenForWaiting = useCallback((registration: ServiceWorkerRegistration) => {
    if (registration.waiting) {
      setWaitingWorker(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) listenForWaiting(registration);
    });

    const onControllerChange = () => setWaitingWorker(null);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, [listenForWaiting]);

  if (!waitingWorker) {
    return null;
  }

  return (
    <aside
      aria-label="Update available"
      className="fixed top-16 right-4 left-4 z-50 md:left-auto md:max-w-sm"
    >
      <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
        <p className="text-sm font-semibold">Update available</p>
        <p className="mt-1 text-xs text-muted">A newer version of KOBA is ready.</p>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() => {
              waitingWorker.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>
    </aside>
  );
}
