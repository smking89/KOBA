import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/koba/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RestartTourButton } from "@/components/koba/restart-tour-button";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { PRODUCT_RARITIES, RARITY_LABEL } from "@/features/marketplace/lib/catalog";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { AccountModeSwitch } from "@/features/accounts/components/account-mode-switch";
import { ACCOUNT_TYPE_LABEL } from "@/features/koba-id/lib/format";
import { TagPrivacyForm } from "@/features/social/components/tag-privacy-form";
import { PlusBadge } from "@/features/plus/components/plus-badge";
import { SocialConnectionsPanel } from "@/features/social-connections/components/social-connections-panel";
import { socialProviderConfiguredMap } from "@/features/social-connections/lib/providers";
import { listUserSocialConnections } from "@/features/social-connections/services/social-connection.service";
import { ConnectedDevicesPanel } from "@/features/oauth-device/components/connected-devices-panel";
import { listAccessTokens } from "@/features/oauth-device/services/device-flow.service";
import { getSteamLink } from "@/features/steam-link/services/steam-link.service";

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

  const socialConnections = await listUserSocialConnections(session.user.id);
  const [steamLink, deviceTokens] = await Promise.all([
    getSteamLink(session.user.id),
    listAccessTokens(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        eyebrowTone="default"
        title="Settings"
        description={`Signed in as ${session.user.email ?? snapshot.displayName}. Each mode is its own KOBAID — switching changes tools for this device. Staff identities are issued by KOBA, never here.`}
      />

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

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Tagging and profile</CardTitle>
        <CardDescription className="mb-4">
          Mentions respect this setting. Blocked accounts can never tag you.
        </CardDescription>
        <TagPrivacyForm initial={snapshot.tagPrivacy} bio={snapshot.bio ?? ""} />
      </Card>

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription className="mb-4">
          Verify ownership through the platform itself — connecting swaps in your real handle and
          links out to your real profile, so a badge can&apos;t be faked.
        </CardDescription>
        <SocialConnectionsPanel
          configured={socialProviderConfiguredMap()}
          connections={socialConnections}
        />
      </Card>

      <Card className="border-t-2 border-t-neon-lime">
        <CardTitle>Steam & connected devices</CardTitle>
        <CardDescription className="mb-4">
          Link Steam so the KOBA PC Plugin knows which local install to apply skins to. Revoke a
          device here if it&apos;s lost or no longer trusted — it can&apos;t act as you afterward.
        </CardDescription>
        <ConnectedDevicesPanel
          initialSteamLink={steamLink ? { steamId64: steamLink.steamId64, personaName: steamLink.personaName } : null}
          initialTokens={deviceTokens.map((token) => ({
            id: token.id,
            clientKey: token.clientKey,
            scopes: token.scopes,
            createdAt: token.createdAt.toISOString(),
            expiresAt: token.expiresAt.toISOString(),
          }))}
        />
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
