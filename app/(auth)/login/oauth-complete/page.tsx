import { Suspense } from "react";
import { OAuthPopupComplete } from "@/features/auth-oauth/components/oauth-popup-complete";

export const metadata = { title: "Signing in…" };

/** Landing page for the OAuth popup window only (features/auth-oauth) —
 * never linked to directly. Relays the result to window.opener and
 * closes itself; the opener does the actual session exchange. */
export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <OAuthPopupComplete />
    </Suspense>
  );
}
