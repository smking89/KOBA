import { describe, expect, it } from "vitest";
import { isAuthPath, isProtectedPath } from "@/lib/auth/protected-routes";

describe("protected routes", () => {
  it("protects settings routes", () => {
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/profile")).toBe(true);
    expect(isProtectedPath("/market")).toBe(false);
  });

  it("recognizes auth routes", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/register")).toBe(true);
    expect(isAuthPath("/verify-email")).toBe(true);
    expect(isAuthPath("/forgot-password")).toBe(true);
    expect(isAuthPath("/reset-password")).toBe(true);
    expect(isAuthPath("/")).toBe(false);
  });
});
