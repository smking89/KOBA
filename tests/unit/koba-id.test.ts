import { describe, expect, it } from "vitest";
import {
  dashboardPathFor,
  generateKobaIdCode,
  isPublicAccountType,
  isStaffAccountType,
  isValidKobaId,
} from "@/features/koba-id/lib/format";
import { canIssueStaffRole } from "@/features/koba-id/lib/staff-auth";
import {
  createIdentityWithCollisionRetry,
  MAX_COLLISION_ATTEMPTS,
} from "@/features/koba-id/lib/collision-retry";
import { KobaIdError } from "@/features/koba-id/services/koba-id-error";
import {
  issueStaffKobaIdSchema,
  switchAccountSchema,
} from "@/features/accounts/schemas/account.schemas";
import { registerSchema } from "@/features/auth/schemas/auth.schemas";

function bytesFromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((part) => Number.parseInt(part, 16)));
}

describe("KOBAID format", () => {
  it("builds cryptographically supplied suffixes in KOBA-PL-XXXX form", () => {
    const code = generateKobaIdCode("PLAYER", () => bytesFromHex("9f42"));
    expect(code).toBe("KOBA-PL-9F42");
    expect(isValidKobaId(code)).toBe(true);
  });

  it("maps each public and staff role to the product prefix", () => {
    expect(generateKobaIdCode("BUSINESS", () => bytesFromHex("88a0"))).toBe("KOBA-BZ-88A0");
    expect(generateKobaIdCode("INFLUENCER", () => bytesFromHex("0001"))).toBe("KOBA-IN-0001");
    expect(generateKobaIdCode("SUPERADMIN", () => bytesFromHex("abcd"))).toBe("KOBA-SA-ABCD");
    expect(generateKobaIdCode("ADMIN", () => bytesFromHex("1111"))).toBe("KOBA-AD-1111");
    expect(generateKobaIdCode("MODERATOR", () => bytesFromHex("2222"))).toBe("KOBA-MD-2222");
  });

  it("never treats staff types as public", () => {
    expect(isPublicAccountType("PLAYER")).toBe(true);
    expect(isPublicAccountType("SUPERADMIN")).toBe(false);
    expect(isStaffAccountType("ADMIN")).toBe(true);
    expect(isStaffAccountType("BUSINESS")).toBe(false);
  });

  it("routes dashboards by active account type", () => {
    expect(dashboardPathFor("PLAYER")).toBe("/dashboard");
    expect(dashboardPathFor("BUSINESS")).toBe("/business");
    expect(dashboardPathFor("INFLUENCER")).toBe("/influencer");
    expect(dashboardPathFor("SUPERADMIN")).toBe("/admin");
  });
});

describe("staff issuance authorization", () => {
  it("lets superadmin issue every staff role", () => {
    expect(canIssueStaffRole(["SUPERADMIN"], "SUPERADMIN")).toBe(true);
    expect(canIssueStaffRole(["SUPERADMIN"], "ADMIN")).toBe(true);
    expect(canIssueStaffRole(["SUPERADMIN"], "MODERATOR")).toBe(true);
  });

  it("lets admin issue moderator only", () => {
    expect(canIssueStaffRole(["ADMIN"], "MODERATOR")).toBe(true);
    expect(canIssueStaffRole(["ADMIN"], "ADMIN")).toBe(false);
    expect(canIssueStaffRole(["ADMIN"], "SUPERADMIN")).toBe(false);
  });

  it("never lets players issue staff identities", () => {
    expect(canIssueStaffRole(["PLAYER"], "MODERATOR")).toBe(false);
    expect(canIssueStaffRole([], "ADMIN")).toBe(false);
  });
});

describe("collision retry", () => {
  it("retries on unique constraint collisions then succeeds", async () => {
    const codes: string[] = [];
    let calls = 0;
    const result = await createIdentityWithCollisionRetry({
      accountType: "PLAYER",
      randomBytesFn: () => {
        calls += 1;
        return calls === 1 ? bytesFromHex("aaaa") : bytesFromHex("bbbb");
      },
      create: async (code) => {
        codes.push(code);
        if (codes.length === 1) {
          throw { code: "P2002" };
        }
        return { code };
      },
    });

    expect(codes).toEqual(["KOBA-PL-AAAA", "KOBA-PL-BBBB"]);
    expect(result).toEqual({ code: "KOBA-PL-BBBB" });
  });

  it("stops after the collision budget", async () => {
    await expect(
      createIdentityWithCollisionRetry({
        accountType: "PLAYER",
        randomBytesFn: () => bytesFromHex("ffff"),
        maxAttempts: 3,
        create: async () => {
          throw { code: "P2002" };
        },
      }),
    ).rejects.toMatchObject({ code: "COLLISION" } satisfies Partial<KobaIdError>);
    expect(MAX_COLLISION_ATTEMPTS).toBeGreaterThan(1);
  });
});

describe("public schemas reject staff", () => {
  it("rejects staff types on registration", () => {
    const result = registerSchema.safeParse({
      name: "Player One",
      email: "player@example.com",
      password: "SecurePass123",
      accountType: "SUPERADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects staff types on account switch", () => {
    expect(switchAccountSchema.safeParse({ accountType: "ADMIN" }).success).toBe(false);
    expect(switchAccountSchema.safeParse({ accountType: "PLAYER" }).success).toBe(true);
  });

  it("accepts staff types only on the admin issuance schema", () => {
    expect(
      issueStaffKobaIdSchema.safeParse({
        email: "staff@example.com",
        accountType: "MODERATOR",
      }).success,
    ).toBe(true);
    expect(
      issueStaffKobaIdSchema.safeParse({
        email: "staff@example.com",
        accountType: "PLAYER",
      }).success,
    ).toBe(false);
  });
});
