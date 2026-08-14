import type { NextAuthConfig } from "next-auth";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

type SessionUpdate = {
  kobaId?: string | null;
  accountType?: KobaAccountType | null;
  kobaIdRevealed?: boolean;
};

/** Shared Auth.js config safe for middleware (no database imports). */
export const edgeAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
        token.kobaId = typeof user.kobaId === "string" ? user.kobaId : null;
        token.accountType = user.accountType ?? null;
        token.kobaIdRevealed = user.kobaIdRevealed === true;
      }

      if (trigger === "update" && session && typeof session === "object") {
        const update = session as SessionUpdate;
        if ("kobaId" in update) {
          token.kobaId = update.kobaId ?? null;
        }
        if ("accountType" in update) {
          token.accountType = update.accountType ?? null;
        }
        if ("kobaIdRevealed" in update) {
          token.kobaIdRevealed = update.kobaIdRevealed ?? false;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.kobaId = typeof token.kobaId === "string" ? token.kobaId : null;
        session.user.accountType =
          typeof token.accountType === "string" ? (token.accountType as KobaAccountType) : null;
        session.user.kobaIdRevealed = token.kobaIdRevealed === true;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
} satisfies NextAuthConfig;
