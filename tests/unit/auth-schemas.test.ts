import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/features/auth/schemas/auth.schemas";

describe("auth schemas", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      name: "Player One",
      email: "player@example.com",
      password: "SecurePass123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects weak registration passwords", () => {
    const result = registerSchema.safeParse({
      name: "Player One",
      email: "player@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "player@example.com",
      password: "any",
    });
    expect(result.success).toBe(true);
  });

  it("requires verify email token length", () => {
    const result = verifyEmailSchema.safeParse({
      email: "player@example.com",
      token: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts reset password payload", () => {
    const result = resetPasswordSchema.safeParse({
      email: "player@example.com",
      token: "a".repeat(32),
      password: "SecurePass123",
    });
    expect(result.success).toBe(true);
  });
});
