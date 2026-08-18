/**
 * "Continue with Discord / Google" login OAuth (client, 2026-08-17: "for
 * the login and register pages, we need oauth"). Separate registry from
 * features/social-connections/lib/providers.ts on purpose — that one is
 * for bio badges (four providers, connect-only, requires an existing
 * session); this one is for signing in itself (two OAuth2 providers here
 * + Steam handled separately in ./steam.ts, since Steam is OpenID 2.0,
 * not OAuth2, and needs no client secret at all).
 *
 * Discord reuses the exact same app credentials as everywhere else in
 * this codebase (DISCORD_CLIENT_ID/_SECRET) — one Discord app, three
 * purposes now (bot-owner identity, bio badge, login) — all distinct
 * concerns, deliberately not unified into one table.
 */
export type LoginOAuthProviderKey = "DISCORD" | "GOOGLE";

export type LoginOAuthConfig = {
  key: LoginOAuthProviderKey;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extracts a stable provider user id, a display name to seed a KOBA
   * handle from, and an email (when the provider gives one — Discord
   * only does with the `email` scope, Google always does). */
  parseUser: (json: Record<string, unknown>) => {
    id: string;
    username: string;
    email: string | null;
  } | null;
};

export const LOGIN_OAUTH_PROVIDERS: Record<LoginOAuthProviderKey, LoginOAuthConfig> = {
  DISCORD: {
    key: "DISCORD",
    label: "Discord",
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/v10/oauth2/token",
    userInfoUrl: "https://discord.com/api/v10/users/@me",
    scope: "identify email",
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    parseUser: (json) => {
      const id = json.id;
      const username = json.username;
      if (typeof id !== "string" || typeof username !== "string") return null;
      const email = typeof json.email === "string" ? json.email : null;
      return { id, username, email };
    },
  },
  GOOGLE: {
    key: "GOOGLE",
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    parseUser: (json) => {
      const id = json.sub;
      if (typeof id !== "string") return null;
      const email = typeof json.email === "string" ? json.email : null;
      const username =
        typeof json.name === "string" ? json.name : (email?.split("@")[0] ?? `google-${id}`);
      return { id, username, email };
    },
  },
};

export function isLoginOAuthConfigured(key: LoginOAuthProviderKey): boolean {
  const config = LOGIN_OAUTH_PROVIDERS[key];
  return Boolean(process.env[config.clientIdEnv]?.trim() && process.env[config.clientSecretEnv]?.trim());
}

export function isValidLoginOAuthProvider(value: string): value is LoginOAuthProviderKey {
  return value in LOGIN_OAUTH_PROVIDERS;
}
