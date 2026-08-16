"use client";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "koba-tour-completed";

export function RestartTourButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // storage blocked — the reload below still shows the tour this once
        }
        window.location.reload();
      }}
    >
      Take the tour
    </Button>
  );
}
