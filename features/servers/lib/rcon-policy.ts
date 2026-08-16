/**
 * Explicit allowlist of Rust WebRCON operations for Phase 14E.
 * Arbitrary command text from browsers, APIs, DB fields, or forms is rejected.
 */

export const RUST_READONLY_ACTIONS = ["SERVER_INFO"] as const;
export type RustReadonlyAction = (typeof RUST_READONLY_ACTIONS)[number];

const ACTION_TO_COMMAND: Record<RustReadonlyAction, "serverinfo"> = {
  SERVER_INFO: "serverinfo",
};

export const RUST_FORBIDDEN_ACTIONS = [
  "KICK",
  "BAN",
  "UNBAN",
  "MUTE",
  "GIVE",
  "SPAWN",
  "TELEPORT",
  "CHANGE_MAP",
  "RESTART",
  "SHUTDOWN",
  "CHANGE_CONFIG",
  "EXECUTE_CONSOLE",
  "ARBITRARY_COMMAND",
  "PLAYER_LIST",
] as const;

export class RconPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RconPolicyError";
  }
}

export function isReadonlyAction(action: string): action is RustReadonlyAction {
  return (RUST_READONLY_ACTIONS as readonly string[]).includes(action);
}

/** Map a fixed internal action to the Facepunch command. Never accepts raw command text. */
export function commandForAction(action: RustReadonlyAction): "serverinfo" {
  return ACTION_TO_COMMAND[action];
}

export function assertReadonlyAction(action: string): RustReadonlyAction {
  if (!isReadonlyAction(action)) {
    throw new RconPolicyError("RCON action is not on the read-only allowlist.");
  }
  return action;
}

export function rejectArbitraryCommand(command: string): never {
  throw new RconPolicyError(`Arbitrary RCON command is forbidden: ${command.slice(0, 24)}`);
}
