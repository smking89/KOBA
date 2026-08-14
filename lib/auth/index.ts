import NextAuth from "next-auth";
import { credentialsProvider } from "@/lib/auth/credentials-provider";
import { edgeAuthConfig } from "@/lib/auth/edge.config";
import { resolveAuthSecret } from "@/lib/auth/secret";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...edgeAuthConfig,
  providers: [credentialsProvider],
  secret: resolveAuthSecret(),
  trustHost: true,
});
