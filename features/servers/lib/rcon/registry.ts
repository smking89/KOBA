/**
 * Per-game, per-platform protocol adapter lookup. Real support only
 * where a real protocol is actually known — everything else fails
 * closed as UNSUPPORTED rather than pretending to work.
 *
 * RCON (admin commands) and live-status querying (player count/map) are
 * genuinely different capabilities that don't always come from the same
 * protocol — decoupled into two lookups rather than one, since Rust
 * Console Edition turned out to have real RCON support (WebRcon) with
 * no confirmed live-query equivalent, a combination the earlier
 * single-`ServerProtocol` design couldn't express.
 *
 * - **RCON**: PC Rust/Garry's Mod use classic Source RCON (raw TCP,
 *   source-rcon.ts). Rust — PC *and* Console Edition — also support
 *   Facepunch's own WebRcon (WebSocket, rust-webrcon.ts); confirmed via
 *   GPORTAL's official wiki for Console Edition specifically, not
 *   inferred. This is what closes the console-Rust gap: not a
 *   proprietary console-hosting-provider API, the same official
 *   Facepunch protocol GPORTAL/Nitrado dashboards already expose the
 *   host/port/password for.
 * - **Live query (A2S_INFO)**: PC Source-engine only. Whether Console
 *   Edition exposes a reachable A2S UDP query port is NOT confirmed —
 *   deliberately not assumed just because RCON works; stays null for
 *   CONSOLE regardless of game.
 */
export type RconProtocol = "SOURCE" | "RUST_WEBRCON";
export type QueryProtocol = "SOURCE_A2S";
export type ServerPlatformFamily = "PC" | "CONSOLE";

export function rconProtocolForGame(
  game: string,
  platformFamily: ServerPlatformFamily,
): RconProtocol | null {
  const normalized = game.trim().toLowerCase();
  if (normalized === "rust") {
    // Both platforms: WebRcon is confirmed for Console Edition and also
    // works for PC (Facepunch ships it as the modern default). Classic
    // Source RCON remains available as a fallback for PC servers that
    // haven't enabled rcon.web — but WebRcon is the one protocol proven
    // to work on both, so it's the one actually wired into
    // testRconConnection (see server.service.ts).
    return "RUST_WEBRCON";
  }
  if (platformFamily === "PC" && (normalized === "garry's mod" || normalized === "garrysmod")) {
    return "SOURCE";
  }
  return null;
}

export function queryProtocolForGame(
  game: string,
  platformFamily: ServerPlatformFamily,
): QueryProtocol | null {
  if (platformFamily !== "PC") {
    return null; // not confirmed reachable for Console Edition — see doc comment above
  }
  const normalized = game.trim().toLowerCase();
  return normalized === "rust" || normalized === "garry's mod" || normalized === "garrysmod"
    ? "SOURCE_A2S"
    : null;
}
