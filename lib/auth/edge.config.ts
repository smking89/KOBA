import type { NextAuthConfig } from "next-auth";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

/** Shared Auth.js config safe for middleware (no database imports). */
export const edgeAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.kobaId = typeof user.kobaId === "string" ? user.kobaId : null;
        token.accountType = user.accountType ?? null;
        token.kobaIdRevealed = user.kobaIdRevealed === true;
        token.handle = typeof user.handle === "string" ? user.handle : null;
        token.plusBadge = user.plusBadge === true;
        if (typeof user.name === "string") token.name = user.name;
        if (typeof user.email === "string") token.email = user.email;
        if (typeof user.image === "string") token.picture = user.image;
      }

      // KOBA-SEC-004: `update()` payloads arrive from the browser and are
      // NEVER trusted here. The node auth instance (lib/auth/index.ts)
      // re-derives claims from the database on the "update" trigger.
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.kobaId = typeof token.kobaId === "string" ? token.kobaId : null;
        session.user.accountType =
          typeof token.accountType === "string" ? (token.accountType as KobaAccountType) : null;
        session.user.kobaIdRevealed = token.kobaIdRevealed === true;
        session.user.handle = typeof token.handle === "string" ? token.handle : null;
        session.user.plusBadge = token.plusBadge === true;
        if (typeof token.picture === "string") {
          session.user.image = token.picture;
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
} satisfies NextAuthConfig;
