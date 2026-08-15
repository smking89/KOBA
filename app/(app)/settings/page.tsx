import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { AccountModeSwitch } from "@/features/accounts/components/account-mode-switch";
import { ACCOUNT_TYPE_LABEL } from "@/features/koba-id/lib/format";
import { TagPrivacyForm } from "@/features/social/components/tag-privacy-form";
import { PlusBadge } from "@/features/plus/components/plus-badge";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge>Account</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Signed in as {session.user.email ?? snapshot.displayName}. Each mode is its own KOBAID —
          switching changes tools for this device. Staff identities are issued by KOBA, never here.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account mode</h2>
        <AccountModeSwitch snapshot={snapshot} />
      </section>

      <Card>
        <CardTitle>Identity</CardTitle>
        <CardDescription>
          Handle{" "}
          <Link href={`/u/${snapshot.handle}`} className="text-neon-lime hover:underline">
            @{snapshot.handle}
          </Link>
          {" · "}
          Active KOBAID{" "}
          <span className="font-mono text-foreground">{snapshot.kobaId ?? "pending"}</span>
          {" · "}
          {ACCOUNT_TYPE_LABEL[snapshot.activeAccountType]}
          {snapshot.plusBadge ? (
            <>
              {" · "}
              <PlusBadge visible />
            </>
          ) : null}
        </CardDescription>
        <p className="mt-3 text-sm text-muted">
          <Link href="/settings/security" className="text-neon-lime hover:underline">
            Security
          </Link>
          {" · "}
          <Link href="/plus" className="text-neon-lime hover:underline">
            Manage KOBA Plus
          </Link>{" "}
          for this active account.
        </p>
      </Card>

      <Card>
        <CardTitle>Tagging and profile</CardTitle>
        <CardDescription className="mb-4">
          Mentions respect this setting. Blocked accounts can never tag you.
        </CardDescription>
        <TagPrivacyForm initial={snapshot.tagPrivacy} bio={snapshot.bio ?? ""} />
      </Card>

      <Card>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Technical light tokens may exist later for tooling, but KOBA ships dark-first.
        </CardDescription>
      </Card>
    </div>
  );
}
