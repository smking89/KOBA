import NextAuth from "next-auth";
import { credentialsProvider } from "@/lib/auth/credentials-provider";
import { edgeAuthConfig } from "@/lib/auth/edge.config";
import { resolveAuthSecret } from "@/lib/auth/secret";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...edgeAuthConfig,
  providers: [credentialsProvider],
  secret: resolveAuthSecret(),
  trustHost: true,
  callbacks: {
    ...edgeAuthConfig.callbacks,
    async jwt(params) {
      const token = edgeAuthConfig.callbacks.jwt(params);

      // KOBA-SEC-004: on session update, ignore whatever the client sent and
      // refresh identity claims from the database. Client-supplied
      // accountType/kobaId payloads must never reach the JWT.
      if (params.trigger === "update" && token.sub) {
        const { getAccountSnapshot } = await import("@/features/accounts/services/account.service");
        const snapshot = await getAccountSnapshot(token.sub);
        token.kobaId = snapshot?.kobaId ?? null;
        token.accountType = snapshot?.activeAccountType ?? null;
        token.kobaIdRevealed = snapshot?.kobaIdRevealed === true;
        token.handle = snapshot?.handle ?? null;
        token.plusBadge = snapshot?.plusBadge === true;
        if (snapshot?.displayName) token.name = snapshot.displayName;
        if (snapshot?.image) token.picture = snapshot.image;
      } else if (token.sub && typeof token.handle !== "string") {
        const { getAccountSnapshot } = await import("@/features/accounts/services/account.service");
        const snapshot = await getAccountSnapshot(token.sub);
        token.handle = snapshot?.handle ?? "";
        token.plusBadge = snapshot?.plusBadge === true;
        if (snapshot?.image) token.picture = snapshot.image;
      }

      return token;
    },
  },
});
