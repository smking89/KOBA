import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { dashboardPathFor } from "@/features/koba-id/lib/format";
import { mintPublicKobaId } from "@/features/koba-id/services/mint.service";

export const metadata = { title: "Enter KOBA" };

export default async function EnterPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/enter");
  }

  let snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (!snapshot.kobaId) {
    await mintPublicKobaId(session.user.id, snapshot.activeAccountType);
    snapshot = await getAccountSnapshot(session.user.id);
  }

  if (!snapshot?.kobaIdRevealed) {
    redirect("/kobaid");
  }

  redirect(dashboardPathFor(snapshot.activeAccountType));
}
