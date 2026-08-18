"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OAUTH_DEVICE_CLIENTS, type OAuthDeviceClientKey } from "@/features/oauth-device/lib/clients";
import { TextIdentityLink } from "@/features/game-identity/components/text-identity-link";

type DeviceToken = {
  id: string;
  clientKey: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
};

type SteamLink = { steamId64: string; personaName: string | null } | null;

export function ConnectedDevicesPanel({
  initialSteamLink,
  initialXboxGamertag,
  initialPsnUsername,
  initialTokens,
}: {
  initialSteamLink: SteamLink;
  initialXboxGamertag: string | null;
  initialPsnUsername: string | null;
  initialTokens: DeviceToken[];
}) {
  const [steamLink, setSteamLink] = useState(initialSteamLink);
  const [tokens, setTokens] = useState(initialTokens);
  const [pending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [unlinkingSteam, setUnlinkingSteam] = useState(false);

  function unlinkSteam() {
    setUnlinkingSteam(true);
    startTransition(async () => {
      const response = await fetch("/api/steam-link/unlink", { method: "POST" });
      setUnlinkingSteam(false);
      if (response.ok) setSteamLink(null);
    });
  }

  function revoke(tokenId: string) {
    setRevokingId(tokenId);
    startTransition(async () => {
      const response = await fetch(`/api/oauth/device/tokens/${tokenId}`, { method: "DELETE" });
      setRevokingId(null);
      if (response.ok) setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">Steam account</p>
        {steamLink ? (
          <div className="mt-2 flex items-center justify-between rounded-md border border-white/10 p-3 text-sm">
            <span>{steamLink.personaName ?? steamLink.steamId64}</span>
            <Button type="button" variant="ghost" size="sm" disabled={unlinkingSteam} onClick={unlinkSteam}>
              {unlinkingSteam ? "Unlinking…" : "Unlink"}
            </Button>
          </div>
        ) : (
          <a href="/api/steam-link/start" className={cn(buttonVariants({ variant: "secondary" }), "mt-2")}>
            Link Steam
          </a>
        )}
      </div>

      <TextIdentityLink
        label="Xbox gamertag"
        placeholder="YourGamertag"
        apiPath="/api/game-identity/xbox"
        bodyKey="gamertag"
        initialValue={initialXboxGamertag}
      />

      <TextIdentityLink
        label="PSN username"
        placeholder="YourPSNUsername"
        apiPath="/api/game-identity/playstation"
        bodyKey="psnUsername"
        initialValue={initialPsnUsername}
      />

      <div>
        <p className="text-sm font-medium">Connected devices</p>
        <p className="mt-1 text-xs text-muted">
          Apps that can act as you without a browser session — the KOBA PC Plugin, once installed.
        </p>
        {tokens.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No devices connected yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center justify-between rounded-md border border-white/10 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {OAUTH_DEVICE_CLIENTS[token.clientKey as OAuthDeviceClientKey]?.label ?? token.clientKey}
                  </p>
                  <p className="text-xs text-muted">
                    Connected {new Date(token.createdAt).toLocaleDateString()} · {token.scopes.join(", ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending && revokingId === token.id}
                  onClick={() => revoke(token.id)}
                >
                  {revokingId === token.id ? "Revoking…" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
