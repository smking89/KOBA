import { describe, expect, it } from "vitest";
import {
  canIssueStaffRole,
  canStaffApproveListing,
  canStaffModerateContent,
  canStaffRefund,
  canStaffVerifyShop,
  isAnyStaff,
} from "@/features/admin/lib/access";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

describe("staff access matrix", () => {
  it("treats SA/AD/MD as staff", () => {
    expect(isAnyStaff(["PLAYER"])).toBe(false);
    expect(isAnyStaff(["SUPERADMIN"])).toBe(true);
    expect(isAnyStaff(["ADMIN"])).toBe(true);
    expect(isAnyStaff(["MODERATOR"])).toBe(true);
  });

  it("lets SA/AD/MD approve listings and moderate content", () => {
    expect(canStaffApproveListing(["MODERATOR"])).toBe(true);
    expect(canStaffModerateContent(["ADMIN"])).toBe(true);
    expect(canStaffApproveListing(["PLAYER"])).toBe(false);
  });

  it("restricts shop verify and refunds to SA/AD", () => {
    expect(canStaffVerifyShop(["SUPERADMIN"])).toBe(true);
    expect(canStaffVerifyShop(["ADMIN"])).toBe(true);
    expect(canStaffVerifyShop(["MODERATOR"])).toBe(false);
    expect(canStaffRefund(["ADMIN"])).toBe(true);
    expect(canStaffRefund(["MODERATOR"])).toBe(false);
  });

  it("limits staff issuance by actor role", () => {
    expect(canIssueStaffRole(["SUPERADMIN"], "SUPERADMIN")).toBe(true);
    expect(canIssueStaffRole(["ADMIN"], "SUPERADMIN")).toBe(false);
    expect(canIssueStaffRole(["ADMIN"], "MODERATOR")).toBe(true);
    expect(canIssueStaffRole(["MODERATOR"], "MODERATOR")).toBe(false);
  });
});

describe("staff routes", () => {
  it("protects /admin and never caches admin APIs", () => {
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isSensitivePath("/api/admin/overview")).toBe(true);
    expect(isSensitivePath("/api/admin/reports/KOBA-RPT-STAFF001/resolve")).toBe(true);
    expect(isSensitivePath("/api/admin/products/pending")).toBe(true);
    expect(isSensitivePath("/api/admin/aiden/pending")).toBe(true);
  });
});
