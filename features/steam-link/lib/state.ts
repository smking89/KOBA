import { SignJWT, jwtVerify } from "jose";
import { resolveAuthSecret } from "@/lib/auth/secret";

/** Short-lived signed state carrying the ALREADY-authenticated user's id
 * through the Steam OpenID redirect round-trip — deliberately separate
 * from features/auth-oauth/lib/state.ts's login state, which carries no
 * userId (you're not logged in yet during login). This is "attach a
 * Steam account to my existing session," not a sign-in. */
export type SteamLinkState = { userId: string };

export async function signSteamLinkState(state: SteamLinkState): Promise<string> {
  const secret = new TextEncoder().encode(resolveAuthSecret());
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

export async function verifySteamLinkState(state: string): Promise<SteamLinkState | null> {
  try {
    const secret = new TextEncoder().encode(resolveAuthSecret());
    const { payload } = await jwtVerify(state, secret);
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
