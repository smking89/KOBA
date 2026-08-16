"use client";

import { Button } from "@/components/ui/button";

export function RestartTourButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        window.location.href = "/?tour=1";
      }}
    >
      Take the tour
    </Button>
  );
}
