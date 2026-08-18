/**
 * Discord bot invite link handling for App Store submissions
 * (2026-08-18: "pc devs input there link...discord bot devs...input
 * there discord bot invite link"). A bot isn't a distributable file —
 * it's a hosted service the developer runs themselves — so the invite
 * URL itself IS the install artifact, the same pattern every real
 * Discord bot directory (top.gg, Discord's own directory) uses.
 *
 * This only validates the URL is a well-formed Discord OAuth2 invite
 * and extracts the bot's application (client) ID — it does NOT prove
 * the submitting developer owns that application. That's a separate,
 * harder problem (see discord-oauth.ts's docblock) and isn't built yet;
 * `DevProduct.discordVerifiedAt` stays null until it is.
 */

const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"]);

export type ParsedDiscordInvite = {
  clientId: string;
  /** True when the link requests the "bot" OAuth scope — a sanity check
   * that this is actually a bot-install link, not e.g. a plain user
   * OAuth login link reusing the same endpoint shape. */
  isBotInvite: boolean;
};

/**
 * Parses a Discord OAuth2 authorize URL and extracts the application's
 * client ID. Returns null for anything that isn't a well-formed Discord
 * invite link — malformed input fails closed rather than guessing.
 */
export function parseDiscordInviteUrl(input: string): ParsedDiscordInvite | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (!DISCORD_HOSTS.has(url.hostname)) return null;

  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "/oauth2/authorize" && path !== "/api/oauth2/authorize") return null;

  const clientId = url.searchParams.get("client_id");
  if (!clientId || !/^\d{15,25}$/.test(clientId)) return null;

  const scope = url.searchParams.get("scope") ?? "";
  const isBotInvite = scope.split(/[\s+]+/).includes("bot");

  return { clientId, isBotInvite };
}

/** Discord's public, unauthenticated application-RPC endpoint — used to
 * auto-populate a bot listing's name/icon from its real invite link
 * without requiring the developer to re-type anything. No OAuth needed
 * for this call. NOTE: this endpoint's exact shape hasn't been
 * live-verified against Discord's current API from this environment
 * (no network access at build time) — it's built to fail soft
 * (`null` on anything unexpected) specifically because of that. Smoke-
 * test against a real invite link once deployed; if the response shape
 * has changed, this degrades to "no auto-fill," not a broken form. */
export async function fetchPublicDiscordApplication(
  clientId: string,
): Promise<{ name: string; iconUrl: string | null; description: string } | null> {
  try {
    const response = await fetch(`https://discord.com/api/v10/applications/${clientId}/rpc`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      name?: string;
      icon?: string | null;
      description?: string;
    };
    if (!data.name) return null;
    return {
      name: data.name,
      iconUrl: data.icon ? `https://cdn.discordapp.com/app-icons/${clientId}/${data.icon}.png` : null,
      description: data.description ?? "",
    };
  } catch {
    // Network failure, Discord outage, or a private (non-public) app —
    // fail soft. The submission form still works with what the
    // developer typed in by hand; this is enrichment, not a gate.
    return null;
  }
}
