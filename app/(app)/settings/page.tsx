import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HexAvatar } from "@/components/koba/hex-avatar";
import { RestartTourButton } from "@/components/koba/restart-tour-button";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { PRODUCT_RARITIES, RARITY_LABEL } from "@/features/marketplace/lib/catalog";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { AccountModeSwitch } from "@/features/accounts/components/account-mode-switch";
import { ACCOUNT_TYPE_LABEL } from "@/features/koba-id/lib/format";
import { TagPrivacyForm } from "@/features/social/components/tag-privacy-form";

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
      <div className="h-20 rounded-2xl bg-brand-gradient md:h-28" />

      <header className="-mt-10 flex flex-wrap items-end gap-4 px-2 md:-mt-12">
        <HexAvatar name={snapshot.displayName ?? snapshot.handle} size="lg" />
        <div className="pb-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted">
            Signed in as {session.user.email ?? snapshot.displayName}
          </p>
        </div>
      </header>

      <p className="max-w-2xl px-2 text-sm text-muted">
        Each mode is its own KOBAID — switching changes tools for this device. Staff identities
        are issued by KOBA, never here.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account mode</h2>
        <AccountModeSwitch snapshot={snapshot} />
      </section>

      <Card className="border-t-2 border-t-neon-lime">
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
        </CardDescription>
      </Card>

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Tagging and profile</CardTitle>
        <CardDescription className="mb-4">
          Mentions respect this setting. Blocked accounts can never tag you.
        </CardDescription>
        <TagPrivacyForm initial={snapshot.tagPrivacy} bio={snapshot.bio ?? ""} />
      </Card>

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Rarity legend</CardTitle>
        <CardDescription className="mb-4">
          Marketplace listings show a rarity icon instead of the word — here&apos;s what each one
          means, low to high.
        </CardDescription>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PRODUCT_RARITIES.map((rarity) => (
            <li key={rarity} className="flex items-center gap-3">
              <RarityChip rarity={rarity} />
              <span className="text-sm text-muted">{RARITY_LABEL[rarity]}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Technical light tokens may exist later for tooling, but KOBA ships dark-first.
        </CardDescription>
      </Card>

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Getting started</CardTitle>
        <CardDescription className="mb-4">
          Replay the welcome walkthrough — Market, Groups &amp; LFG, Servers, Aiden &amp; Coins.
        </CardDescription>
        <RestartTourButton />
      </Card>
    </div>
  );
}
