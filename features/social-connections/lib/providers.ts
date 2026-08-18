/**
 * Verified social account connections for user and shop bios (client,
 * 2026-08-18: "for the social media icons in shop bios, and user bios,
 * they need auth to connect their accounts"). One config entry per
 * provider — each needs its own registered OAuth app (client ID +
 * secret) to actually work; `configured()` reports which ones do right
 * now, same fail-soft convention as Stripe/Aiden/Discord elsewhere.
 *
 * Discord reuses the exact same app credentials as the developer
 * "Connect Discord" flow (features/developers/lib/discord-oauth.ts) —
 * one Discord OAuth app, two different connection purposes (bot-owner
 * identity vs. bio badge). Twitter/YouTube/Twitch need their own
 * separate app registrations (a Twitter Developer app, a Google Cloud
 * project with the YouTube Data API enabled, a Twitch Developer
 * console app) that don't exist yet — building the OAuth plumbing for
 * all four now, so adding real credentials later is a config change,
 * not a code change.
 */
export type SocialProviderKey = "DISCORD" | "TWITTER" | "YOUTUBE" | "TWITCH";

export type SocialProviderConfig = {
  key: SocialProviderKey;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  /** Twitter's OAuth 2.0 requires PKCE; the others don't need it. */
  usesPkce: boolean;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extracts a stable provider user id, a display username, and (when
   * derivable) a public profile URL from that provider's own user-info
   * response shape — each API returns different field names. */
  parseUser: (json: Record<string, unknown>) => {
    id: string;
    username: string;
    profileUrl: string | null;
  } | null;
};

export const SOCIAL_PROVIDERS: Record<SocialProviderKey, SocialProviderConfig> = {
  DISCORD: {
    key: "DISCORD",
    label: "Discord",
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/v10/oauth2/token",
    userInfoUrl: "https://discord.com/api/v10/users/@me",
    scope: "identify",
    usesPkce: false,
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    parseUser: (json) => {
      const id = json.id;
      const username = json.username;
      if (typeof id !== "string" || typeof username !== "string") return null;
      return { id, username, profileUrl: null };
    },
  },
  TWITTER: {
    key: "TWITTER",
    label: "X (Twitter)",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    userInfoUrl: "https://api.twitter.com/2/users/me",
    scope: "users.read tweet.read",
    usesPkce: true,
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
    parseUser: (json) => {
      const data = json.data as { id?: string; username?: string } | undefined;
      if (!data?.id || !data.username) return null;
      return { id: data.id, username: data.username, profileUrl: `https://x.com/${data.username}` };
    },
  },
  YOUTUBE: {
    key: "YOUTUBE",
    label: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    usesPkce: false,
    clientIdEnv: "YOUTUBE_CLIENT_ID",
    clientSecretEnv: "YOUTUBE_CLIENT_SECRET",
    parseUser: (json) => {
      const items = json.items as Array<{ id?: string; snippet?: { title?: string } }> | undefined;
      const channel = items?.[0];
      if (!channel?.id || !channel.snippet?.title) return null;
      return {
        id: channel.id,
        username: channel.snippet.title,
        profileUrl: `https://youtube.com/channel/${channel.id}`,
      };
    },
  },
  TWITCH: {
    key: "TWITCH",
    label: "Twitch",
    authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    userInfoUrl: "https://api.twitch.tv/helix/users",
    scope: "user:read:email",
    usesPkce: false,
    clientIdEnv: "TWITCH_CLIENT_ID",
    clientSecretEnv: "TWITCH_CLIENT_SECRET",
    parseUser: (json) => {
      const data = json.data as Array<{ id?: string; login?: string }> | undefined;
      const user = data?.[0];
      if (!user?.id || !user.login) return null;
      return { id: user.id, username: user.login, profileUrl: `https://twitch.tv/${user.login}` };
    },
  },
};

export function isSocialProviderConfigured(key: SocialProviderKey): boolean {
  const config = SOCIAL_PROVIDERS[key];
  return Boolean(process.env[config.clientIdEnv]?.trim() && process.env[config.clientSecretEnv]?.trim());
}

export function isValidSocialProvider(value: string): value is SocialProviderKey {
  return value in SOCIAL_PROVIDERS;
}

/** Configured-status for every provider, keyed for the connections panel. */
export function socialProviderConfiguredMap(): Record<SocialProviderKey, boolean> {
  return {
    DISCORD: isSocialProviderConfigured("DISCORD"),
    TWITTER: isSocialProviderConfigured("TWITTER"),
    YOUTUBE: isSocialProviderConfigured("YOUTUBE"),
    TWITCH: isSocialProviderConfigured("TWITCH"),
  };
}
