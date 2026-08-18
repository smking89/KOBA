import { describe, expect, it } from "vitest";
import { parseDiscordInviteUrl } from "@/features/developers/lib/discord-invite";

describe("parseDiscordInviteUrl", () => {
  it("parses a real bot invite link", () => {
    const result = parseDiscordInviteUrl(
      "https://discord.com/oauth2/authorize?client_id=1431551270807932999&permissions=8&scope=bot%20applications.commands",
    );
    expect(result).toEqual({ clientId: "1431551270807932999", isBotInvite: true });
  });

  it("accepts the /api/oauth2/authorize path variant", () => {
    const result = parseDiscordInviteUrl(
      "https://discord.com/api/oauth2/authorize?client_id=123456789012345678&scope=bot",
    );
    expect(result?.clientId).toBe("123456789012345678");
  });

  it("flags non-bot OAuth links (no bot scope) without rejecting them", () => {
    const result = parseDiscordInviteUrl(
      "https://discord.com/oauth2/authorize?client_id=123456789012345678&scope=identify",
    );
    expect(result).toEqual({ clientId: "123456789012345678", isBotInvite: false });
  });

  it("rejects non-Discord hosts", () => {
    expect(
      parseDiscordInviteUrl("https://evil.example/oauth2/authorize?client_id=123456789012345678"),
    ).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(parseDiscordInviteUrl("not a url")).toBeNull();
    expect(parseDiscordInviteUrl("")).toBeNull();
  });

  it("rejects a missing or malformed client_id", () => {
    expect(parseDiscordInviteUrl("https://discord.com/oauth2/authorize?scope=bot")).toBeNull();
    expect(
      parseDiscordInviteUrl("https://discord.com/oauth2/authorize?client_id=not-numeric"),
    ).toBeNull();
  });

  it("rejects http (non-https) links", () => {
    expect(
      parseDiscordInviteUrl("http://discord.com/oauth2/authorize?client_id=123456789012345678"),
    ).toBeNull();
  });

  it("rejects a wrong path on a real Discord host", () => {
    expect(
      parseDiscordInviteUrl("https://discord.com/invite/abc123?client_id=123456789012345678"),
    ).toBeNull();
  });
});
