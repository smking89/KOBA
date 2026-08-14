import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath, prefersNetworkFirst } from "@/lib/pwa/sensitive-routes";
import { generateConversationRef, generateMessageRef } from "@/features/messages/lib/refs";
import {
  canMessageUser,
  conversationPairKey,
  isHttpsMediaUrl,
  shouldPersistVanish,
  unreadCount,
  VANISH_LIMITATIONS,
} from "@/features/messages/lib/rules";
import { sendMessageSchema } from "@/features/messages/schemas/message.schemas";

function bytesFromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((part) => Number.parseInt(part, 16)));
}

describe("DM authorization", () => {
  it("blocks self-DM and blocked peers", () => {
    expect(canMessageUser({ actorUserId: "a", targetUserId: "a", blocked: false })).toBe(false);
    expect(canMessageUser({ actorUserId: "a", targetUserId: "b", blocked: true })).toBe(false);
    expect(canMessageUser({ actorUserId: "a", targetUserId: "b", blocked: false })).toBe(true);
  });

  it("builds a stable pair key regardless of argument order", () => {
    expect(conversationPairKey("user-b", "user-a")).toBe("user-a:user-b");
    expect(conversationPairKey("user-a", "user-b")).toBe("user-a:user-b");
  });
});

describe("vanish mode", () => {
  it("inherits conversation vanish unless explicitly overridden", () => {
    expect(shouldPersistVanish(true)).toBe(true);
    expect(shouldPersistVanish(false)).toBe(false);
    expect(shouldPersistVanish(false, true)).toBe(true);
    expect(shouldPersistVanish(true, false)).toBe(false);
  });

  it("documents that screenshots cannot be prevented", () => {
    expect(VANISH_LIMITATIONS.toLowerCase()).toContain("screenshot");
  });
});

describe("message media and unread", () => {
  it("requires https for voice and attachment URLs", () => {
    expect(isHttpsMediaUrl("https://cdn.koba.example/note.webm")).toBe(true);
    expect(isHttpsMediaUrl("http://cdn.koba.example/note.webm")).toBe(false);
    expect(sendMessageSchema.safeParse({ kind: "VOICE" }).success).toBe(false);
    expect(
      sendMessageSchema.safeParse({
        kind: "VOICE",
        mediaUrl: "https://cdn.koba.example/note.webm",
        mediaDurationMs: 14000,
      }).success,
    ).toBe(true);
  });

  it("marks unread only when the peer sent after last read", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const earlier = new Date("2026-08-14T11:00:00.000Z");
    expect(
      unreadCount({ lastReadAt: earlier, lastMessageAt: now, lastMessageFromSelf: false }),
    ).toBe(1);
    expect(unreadCount({ lastReadAt: now, lastMessageAt: now, lastMessageFromSelf: false })).toBe(
      0,
    );
    expect(
      unreadCount({ lastReadAt: earlier, lastMessageAt: now, lastMessageFromSelf: true }),
    ).toBe(0);
  });

  it("mints public conversation and message refs", () => {
    expect(generateConversationRef(() => bytesFromHex("cafebabe"))).toBe("KOBA-DM-CAFEBABE");
    expect(generateMessageRef(() => bytesFromHex("deadbeef"))).toBe("KOBA-MSG-DEADBEEF");
  });
});

describe("messages routes", () => {
  it("never caches DMs and protects the inbox", () => {
    expect(isSensitivePath("/api/messages")).toBe(true);
    expect(isSensitivePath("/api/messages/KOBA-DM-WIPE0001/stream")).toBe(true);
    expect(prefersNetworkFirst("/messages")).toBe(true);
    expect(isProtectedPath("/messages")).toBe(true);
    expect(isProtectedPath("/messages/KOBA-DM-WIPE0001")).toBe(true);
  });
});
