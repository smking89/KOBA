import { SignJWT, jwtVerify } from "jose";
import { resolveAuthSecret } from "@/lib/auth/secret";

/** Short-lived (5 min) signed state for the login-OAuth redirect
 * round-trip — carries only the provider and, for Steam, nothing else
 * (Steam's OpenID response is self-verifying against steamcommunity.com,
 * no server-side secret needed beyond this anti-CSRF nonce). Reuses
 * AUTH_SECRET like features/social-connections does, not a new key. */
export type LoginOAuthState = { provider: string; callbackUrl: string };

export async function signLoginOAuthState(state: LoginOAuthState): Promise<string> {
  const secret = new TextEncoder().encode(resolveAuthSecret());
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

export async function verifyLoginOAuthState(state: string): Promise<LoginOAuthState | null> {
  try {
    const secret = new TextEncoder().encode(resolveAuthSecret());
    const { payload } = await jwtVerify(state, secret);
    if (typeof payload.provider !== "string") return null;
    return {
      provider: payload.provider,
      callbackUrl: typeof payload.callbackUrl === "string" ? payload.callbackUrl : "/dashboard",
    };
  } catch {
    return null;
  }
}
