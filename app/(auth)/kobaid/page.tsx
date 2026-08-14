import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { KobaIdReveal } from "@/features/koba-id/components/koba-id-reveal";
import { mintPublicKobaId } from "@/features/koba-id/services/mint.service";

export const metadata = { title: "Your KOBAID" };

export default async function KobaIdPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/kobaid");
  }

  let snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (!snapshot.kobaId) {
    await mintPublicKobaId(session.user.id, snapshot.activeAccountType);
    snapshot = await getAccountSnapshot(session.user.id);
  }

  if (!snapshot?.kobaId) {
    redirect("/enter");
  }

  return <KobaIdReveal code={snapshot.kobaId} accountType={snapshot.activeAccountType} />;
}
