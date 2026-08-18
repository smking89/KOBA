"use client";

import { useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SOCIAL_PROVIDERS,
  type SocialProviderKey,
} from "@/features/social-connections/lib/providers";

export type SocialConnectionSummary = {
  provider: SocialProviderKey;
  providerUsername: string;
  profileUrl: string | null;
};

const PROVIDER_ORDER: SocialProviderKey[] = ["DISCORD", "TWITTER", "YOUTUBE", "TWITCH"];

type Props = {
  /** Which connect endpoints are actually usable right now — providers
   * missing OAuth app credentials are shown but disabled, not hidden,
   * so the roadmap stays visible. */
  configured: Record<SocialProviderKey, boolean>;
  connections: SocialConnectionSummary[];
  /** Omit for a user-bio panel; pass a shopId to manage a shop's socials
   * instead (same connect/disconnect routes, `?owner=shop&shopId=`). */
  shopId?: string;
};

export function SocialConnectionsPanel({ configured, connections, shopId }: Props) {
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState<SocialProviderKey | null>(null);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  function connectHref(provider: SocialProviderKey) {
    const base = `/api/social-connections/${provider.toLowerCase()}/connect`;
    return shopId ? `${base}?owner=shop&shopId=${shopId}` : base;
  }

  async function disconnect(provider: SocialProviderKey) {
    setDisconnecting(provider);
    try {
      await fetch(`/api/social-connections/${provider.toLowerCase()}/disconnect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(shopId ? { shopId } : {}),
      });
      startTransition(() => {
        window.location.reload();
      });
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <ul className="space-y-2">
      {PROVIDER_ORDER.map((key) => {
        const config = SOCIAL_PROVIDERS[key];
        const connection = byProvider.get(key);
        const canConnect = configured[key];

        return (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{config.label}</p>
              {connection ? (
                <p className="truncate text-xs text-muted">
                  Connected as{" "}
                  {connection.profileUrl ? (
                    <a
                      href={connection.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neon-lime hover:underline"
                    >
                      @{connection.providerUsername}
                    </a>
                  ) : (
                    <span className="text-foreground">@{connection.providerUsername}</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted">
                  {canConnect ? "Not connected." : "Not available yet."}
                </p>
              )}
            </div>

            {connection ? (
              <button
                type="button"
                onClick={() => disconnect(key)}
                disabled={disconnecting === key || pending}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {disconnecting === key ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : (
              <a
                href={canConnect ? connectHref(key) : undefined}
                aria-disabled={!canConnect}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  !canConnect && "pointer-events-none opacity-45",
                )}
              >
                Connect
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
