import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge.config";
import { resolveAuthSecret } from "@/lib/auth/secret";

/** Edge-safe Auth.js instance for middleware session checks. */
export const { auth } = NextAuth({
  ...edgeAuthConfig,
  secret: resolveAuthSecret(),
  trustHost: true,
});
