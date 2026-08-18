/** postMessage contract between the OAuth popup (/login/oauth-complete)
 * and whichever page opened it (OAuthLoginButtons). Kept as one shared
 * source so both sides can't drift on the message shape. */
export const OAUTH_POPUP_MESSAGE_TYPE = "koba-oauth-popup-result";

export type OAuthPopupMessage =
  | { type: typeof OAUTH_POPUP_MESSAGE_TYPE; ok: true; oauthTicket: string }
  | { type: typeof OAUTH_POPUP_MESSAGE_TYPE; ok: false; oauthError: string; provider: string };
