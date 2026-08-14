import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <p className="font-mono text-sm text-neon-lime">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted">That route is not part of the current KOBA build.</p>
      <Link href="/" className={cn(buttonVariants({ variant: "primary" }))}>
        Back home
      </Link>
    </div>
  );
}
