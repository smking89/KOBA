import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center space-y-4 text-center">
      <p className="font-mono text-sm text-neon-lime">Offline</p>
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re not connected</h1>
      <p className="text-sm text-muted">
        KOBA needs a network connection for marketplace and social updates. Cached shell pages may
        still be available when you reconnect.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "primary" }))}>
        Try again
      </Link>
    </div>
  );
}
