/**
 * Rust `kit` console-command builders — the `kit` Oxide/uMod plugin's
 * command syntax, run through a server's web-panel console (GPORTAL,
 * Nitrado, etc.), same RCON transport either protocol client in this
 * directory already sends raw command strings over (source-rcon.ts /
 * rust-webrcon.ts — both take a plain `command: string`).
 *
 * Command syntax confirmed from real, multi-sourced admin documentation
 * (Reddit r/RustConsole, GameServerKings' Rust kits guide, the Rust
 * Console Edition community-servers GitBook) — not guessed:
 *   kit add "[kitname]"
 *   kit add "[kitname]" "[item_shortname]" "[amount]" "[condition]" "[container]"
 *   kit givetoplayer "[kitname]" "[gamertag]"
 *   kit edit "[kitname]" add group "[group_name]"
 */

/** A bare double quote inside a value would break the console's argument
 * parsing — callers give this real kit names / gamertags / item
 * shortnames, none of which should legitimately contain one, but fail
 * loudly rather than emit a malformed command if one somehow does. */
function assertNoDoubleQuote(value: string, label: string): void {
  if (value.includes('"')) {
    throw new Error(`${label} cannot contain a double-quote character: ${value}`);
  }
}

export function buildCreateKitCommand(kitName: string): string {
  assertNoDoubleQuote(kitName, "kitName");
  return `kit add "${kitName}"`;
}

export type KitContainer = "Belt" | "Main" | "Wear";

export function buildAddKitItemCommand(input: {
  kitName: string;
  itemShortname: string;
  amount: number;
  condition: number;
  container: KitContainer;
}): string {
  assertNoDoubleQuote(input.kitName, "kitName");
  assertNoDoubleQuote(input.itemShortname, "itemShortname");
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error(`amount must be a positive integer, got ${input.amount}`);
  }
  if (!Number.isInteger(input.condition) || input.condition < 0) {
    throw new Error(`condition must be a non-negative integer, got ${input.condition}`);
  }
  return `kit add "${input.kitName}" "${input.itemShortname}" "${input.amount}" "${input.condition}" "${input.container}"`;
}

export function buildGiveKitCommand(kitName: string, gamertag: string): string {
  assertNoDoubleQuote(kitName, "kitName");
  assertNoDoubleQuote(gamertag, "gamertag");
  return `kit givetoplayer "${kitName}" "${gamertag}"`;
}

export function buildAssignKitToSpawnGroupCommand(kitName: string, groupName: string): string {
  assertNoDoubleQuote(kitName, "kitName");
  assertNoDoubleQuote(groupName, "groupName");
  return `kit edit "${kitName}" add group "${groupName}"`;
}
