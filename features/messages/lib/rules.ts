/**
 * Vanish mode deletes server-side message rows when a participant leaves the thread.
 * It cannot prevent screenshots, screen recordings, notification previews, device
 * backups, or copies made before purge. Do not advertise otherwise.
 */
export const VANISH_LIMITATIONS =
  "Vanish deletes messages on leave. Screenshots and external copies cannot be prevented.";

export const MESSAGE_KINDS = ["TEXT", "VOICE", "ATTACHMENT", "PRODUCT"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export function conversationPairKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

export function canMessageUser(input: {
  actorUserId: string;
  targetUserId: string;
  blocked: boolean;
}): boolean {
  return input.actorUserId !== input.targetUserId && !input.blocked;
}

export function isHttpsMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function shouldPersistVanish(vanishMode: boolean, explicitVanish?: boolean): boolean {
  if (explicitVanish === true) {
    return true;
  }
  if (explicitVanish === false) {
    return false;
  }
  return vanishMode;
}

export function unreadCount(input: {
  lastReadAt: Date | null;
  lastMessageAt: Date | null;
  lastMessageFromSelf: boolean;
}): number {
  if (!input.lastMessageAt || input.lastMessageFromSelf) {
    return 0;
  }
  if (!input.lastReadAt) {
    return 1;
  }
  return input.lastMessageAt > input.lastReadAt ? 1 : 0;
}
