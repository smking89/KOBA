import { describe, expect, it } from "vitest";
import { resolveSubdomainRewrite } from "@/lib/subdomain-routes";

describe("resolveSubdomainRewrite", () => {
  it("rewrites developer.koba.games to /developers", () => {
    expect(resolveSubdomainRewrite("developer.koba.games", "/")).toBe("/developers");
    expect(resolveSubdomainRewrite("developer.koba.games", "/dashboard")).toBe(
      "/developers/dashboard",
    );
  });

  it("rewrites app.koba.games to /developers/apps", () => {
    expect(resolveSubdomainRewrite("app.koba.games", "/")).toBe("/developers/apps");
    expect(resolveSubdomainRewrite("app.koba.games", "/foo")).toBe("/developers/apps/foo");
  });

  it("rewrites admin.koba.games to /admin", () => {
    expect(resolveSubdomainRewrite("admin.koba.games", "/")).toBe("/admin");
    expect(resolveSubdomainRewrite("admin.koba.games", "/users")).toBe("/admin/users");
  });

  it("rewrites aiden.koba.games to /aiden", () => {
    expect(resolveSubdomainRewrite("aiden.koba.games", "/")).toBe("/aiden");
    expect(resolveSubdomainRewrite("aiden.koba.games", "/generate")).toBe("/aiden/generate");
  });

  it("does not double-prefix a path that's already correct", () => {
    expect(resolveSubdomainRewrite("developer.koba.games", "/developers/dashboard")).toBe(
      "/developers/dashboard",
    );
    expect(resolveSubdomainRewrite("admin.koba.games", "/admin")).toBe("/admin");
  });

  it("leaves the bare apex and www domains untouched", () => {
    expect(resolveSubdomainRewrite("koba.games", "/developers")).toBe("/developers");
    expect(resolveSubdomainRewrite("www.koba.games", "/")).toBe("/");
  });

  it("leaves localhost and preview hosts untouched", () => {
    expect(resolveSubdomainRewrite("localhost:3001", "/aiden")).toBe("/aiden");
    expect(resolveSubdomainRewrite("koba-git-main.vercel.app", "/")).toBe("/");
  });

  it("leaves unrecognized subdomains untouched", () => {
    expect(resolveSubdomainRewrite("staging.koba.games", "/")).toBe("/");
  });

  it("never rewrites API routes, even on a recognized subdomain", () => {
    expect(resolveSubdomainRewrite("developer.koba.games", "/api/developers/apps")).toBe(
      "/api/developers/apps",
    );
    expect(resolveSubdomainRewrite("aiden.koba.games", "/api/aiden/jobs")).toBe(
      "/api/aiden/jobs",
    );
  });
});
