import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { AidenError } from "@/features/aiden/lib/errors";

/**
 * Aiden (aiden.koba.games) is Business-only — a Business KOBAID is
 * required to use any Aiden tool. Same gate shape as
 * features/shops/lib/require-business.ts#requireBusinessDashboard, kept
 * as its own file since Aiden's access boundary is a distinct product
 * rule, not literally "the business dashboard."
 */
export async function requireAidenPage(callbackUrl = "/aiden") {
  const session = await auth();
  if (!session?.user.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (snapshot.activeAccountType !== "BUSINESS") {
    redirect("/enter");
  }

  return { userId: session.user.id, snapshot };
}

/** API-route counterpart — throws instead of redirecting (a redirect
 * response makes no sense for a fetch() call), so every Aiden endpoint
 * enforces the same Business-only boundary server-side, not just the
 * page-level UX. */
export async function assertAidenBusinessAccess(userId: string): Promise<void> {
  const snapshot = await getAccountSnapshot(userId);
  if (!snapshot || snapshot.activeAccountType !== "BUSINESS") {
    throw new AidenError("A Business KOBAID is required to use Aiden.", "FORBIDDEN");
  }
}
