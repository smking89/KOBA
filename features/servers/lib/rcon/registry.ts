/**
 * Per-game, per-platform protocol adapter lookup. Real support only
 * where a real protocol is actually known — everything else fails
 * closed as UNSUPPORTED rather than pretending to work.
 *
 * PC vs Console genuinely aren't the same integration problem, per
 * client clarification (2026-08-15): "console rust servers rcon needs
 * bridge, handlers and listeners... pc rust has access to the
 * configuration files... each game handles rcon differently."
 *
 * - PC: direct network access (TCP RCON + UDP A2S query) — this is
 *   what source-rcon.ts/source-query.ts implement, real and wired for
 *   Rust + Garry's Mod (both Source-engine on PC).
 * - Console: NOT the same game binary. Rust Console Edition is built by
 *   Double Eleven on a separate codebase from Facepunch's PC Rust —
 *   confirmed via research, not assumed — so it can't be assumed to
 *   speak Source RCON at all. Console admin access instead goes through
 *   whichever console-hosting provider's own management API a given
 *   server uses (GPORTAL, Nitrado, etc. each have their own), which
 *   would need a "bridge" service translating KOBA's commands into that
 *   provider's proprietary API/webhooks — a real integration, but one
 *   this codebase has no confirmed provider/API shape for yet. Fails
 *   closed (UNSUPPORTED) rather than guessing one. See ROADMAP.md
 *   Phase 17 open questions.
 */
export type ServerProtocol = "SOURCE";
export type ServerPlatformFamily = "PC" | "CONSOLE";

const PC_SOURCE_GAMES = new Set(["rust", "garry's mod", "garrysmod"]);

export function protocolForGame(
  game: string,
  platformFamily: ServerPlatformFamily,
): ServerProtocol | null {
  if (platformFamily !== "PC") {
    // Console: no confirmed bridge/provider integration exists yet —
    // see the module doc comment above. Deliberately not guessed.
    return null;
  }
  return PC_SOURCE_GAMES.has(game.trim().toLowerCase()) ? "SOURCE" : null;
}
