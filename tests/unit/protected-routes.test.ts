import { describe, expect, it } from "vitest";
import { isAuthPath, isProtectedPath } from "@/lib/auth/protected-routes";

describe("protected routes", () => {
  it("protects identity and dashboard routes", () => {
    expect(isProtectedPath("/kobaid")).toBe(true);
    expect(isProtectedPath("/enter")).toBe(true);
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/business")).toBe(true);
    expect(isProtectedPath("/influencer")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
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
