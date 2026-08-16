import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";

export async function requireInfluencerDashboard(callbackUrl = "/influencer") {
  const session = await auth();
  if (!session?.user.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (snapshot.activeAccountType !== "INFLUENCER") {
    redirect("/enter");
  }

  return { userId: session.user.id, snapshot };
}
