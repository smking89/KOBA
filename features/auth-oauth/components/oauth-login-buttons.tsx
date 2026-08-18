import Link from "next/link";
import { cn } from "@/lib/utils";

const OAUTH_LINKS = [
  { key: "discord", label: "Discord" },
  { key: "steam", label: "Steam" },
  { key: "google", label: "Google" },
] as const;

type Props = {
  callbackUrl: string;
  className?: string;
};

/** Plain server-renderable `<a>` links (not client `signIn()` calls) —
 * each one starts a real redirect round-trip to the provider, so a
 * button that isn't configured yet just bounces back with
 * `?oauthError=not_configured` rather than needing client JS to know
 * which providers are live. */
export function OAuthLoginButtons({ callbackUrl, className }: Props) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {OAUTH_LINKS.map(({ key, label }) => (
        <Link
          key={key}
          href={`/api/auth-oauth/${key}/start?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
