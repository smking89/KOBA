import type { DefaultSession } from "next-auth";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      kobaId: string | null;
      accountType: KobaAccountType | null;
      kobaIdRevealed: boolean;
      impersonatorId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    kobaId?: string | null;
    accountType?: KobaAccountType | null;
    kobaIdRevealed?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    kobaId?: string | null;
    accountType?: KobaAccountType | null;
    kobaIdRevealed?: boolean;
  }
}

export {};
