"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { OAUTH_POPUP_MESSAGE_TYPE, type OAuthPopupMessage } from "@/features/auth-oauth/lib/popup-message";

/** Runs only inside the OAuth popup window (opened by OAuthLoginButtons).
 * Forwards the callback's result to window.opener over postMessage, then
 * closes itself — the opener does the actual signIn("credentials", ...)
 * call, so there's exactly one place that ever exchanges a ticket for a
 * session, popup or not. */
export function OAuthPopupComplete() {
  const searchParams = useSearchParams();
  const oauthTicket = searchParams.get("oauthTicket");
  const oauthError = searchParams.get("oauthError");
  const provider = searchParams.get("provider") ?? "unknown";

  useEffect(() => {
    if (!window.opener || window.opener.closed) {
      // Popup blocker workaround or user opened this link directly —
      // nothing to relay to, nothing to close.
      return;
    }
    const message: OAuthPopupMessage = oauthTicket
      ? { type: OAUTH_POPUP_MESSAGE_TYPE, ok: true, oauthTicket }
      : { type: OAUTH_POPUP_MESSAGE_TYPE, ok: false, oauthError: oauthError ?? "failed", provider };
    window.opener.postMessage(message, window.location.origin);
    window.close();
  }, [oauthTicket, oauthError, provider]);

  return <p className="text-center text-sm text-muted">Signing you in…</p>;
}
