import { PwaInstallPrompt } from "@/components/koba/pwa-install-prompt";
import { PwaProvider } from "@/components/koba/pwa-provider";
import { PwaUpdatePrompt } from "@/components/koba/pwa-update-prompt";
import type { ReactNode } from "react";

export function PwaClientLayer({ children }: { children: ReactNode }) {
  return (
    <PwaProvider>
      {children}
      <PwaInstallPrompt />
      <PwaUpdatePrompt />
    </PwaProvider>
  );
}
