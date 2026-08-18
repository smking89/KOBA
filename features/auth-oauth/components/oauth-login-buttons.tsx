"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import { DiscordIcon, GoogleIcon, SteamIcon } from "@/features/auth-oauth/components/provider-icons";
import { OAUTH_POPUP_MESSAGE_TYPE, type OAuthPopupMessage } from "@/features/auth-oauth/lib/popup-message";

export const OAUTH_ERROR_MESSAGE: Record<string, string> = {
  not_configured: "That sign-in method isn't available yet.",
  denied: "Sign-in was cancelled.",
  email_exists:
    "An account with this email already exists. Sign in with your password, then connect that account from Settings.",
};
export const OAUTH_ERROR_FALLBACK = "Something went wrong signing you in. Try again.";

const PROVIDERS = [
  { key: "discord", label: "Discord", Icon: DiscordIcon },
  { key: "steam", label: "Steam", Icon: SteamIcon },
  { key: "google", label: "Google", Icon: GoogleIcon },
] as const;

const POPUP_FEATURES = "width=480,height=680,menubar=no,toolbar=no,location=no,status=no";

type Props = {
  callbackUrl: string;
  className?: string;
};

/** "Continue with Discord/Steam/Google" — opens each provider's sign-in
 * in a popup window (client, 2026-08-17: confirmed via AskUserQuestion)
 * so the page underneath never navigates away. Falls back to a
 * same-tab redirect automatically if the popup gets blocked. */
export function OAuthLoginButtons({ callbackUrl, className }: Props) {
  const router = useRouter();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as OAuthPopupMessage | undefined;
      if (data?.type !== OAUTH_POPUP_MESSAGE_TYPE) return;

      if (pollRef.current) clearInterval(pollRef.current);
      popupRef.current = null;

      if (!data.ok) {
        setPendingProvider(null);
        setError(OAUTH_ERROR_MESSAGE[data.oauthError] ?? OAUTH_ERROR_FALLBACK);
        return;
      }

      void (async () => {
        const result = await signIn("credentials", { oauthTicket: data.oauthTicket, redirect: false });
        setPendingProvider(null);
        if (result?.error) {
          setError(OAUTH_ERROR_FALLBACK);
          return;
        }
        router.push(callbackUrl);
        router.refresh();
      })();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [callbackUrl, router]);

  function start(providerKey: string) {
    setError(null);
    setPendingProvider(providerKey);
    const url = `/api/auth-oauth/${providerKey}/start?popup=1&callbackUrl=${encodeURIComponent(callbackUrl)}`;

    const popup = window.open(url, "koba-oauth", POPUP_FEATURES);
    if (!popup) {
      // Popup blocked — fall back to a same-tab redirect. The callback
      // route lands back on /login (no `popup=1` this time), which
      // LoginForm's own oauthTicket effect picks up.
      window.location.href = `/api/auth-oauth/${providerKey}/start?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return;
    }
    popupRef.current = popup;

    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(pollRef.current!);
        popupRef.current = null;
        setPendingProvider((current) => (current ? null : current));
      }
    }, 500);
  }

  return (
    <div className={className}>
      <div className="grid gap-2 sm:grid-cols-3">
        {PROVIDERS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => start(key)}
            disabled={pendingProvider !== null}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-60",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {pendingProvider === key ? "Waiting…" : label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
