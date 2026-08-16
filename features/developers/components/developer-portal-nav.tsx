import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/developers/dashboard", label: "Dashboard" },
  { href: "/developers/applications", label: "Applications" },
  { href: "/developers/api-keys", label: "API keys" },
  { href: "/developers/webhooks", label: "Webhooks" },
  { href: "/developers/products", label: "Products" },
] as const;

export function DeveloperPortalNav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Developer portal">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime",
            current === link.href
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
