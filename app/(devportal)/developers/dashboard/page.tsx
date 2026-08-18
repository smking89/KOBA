import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SocialsForm } from "@/features/developers/components/developer-forms";
import { isDiscordOAuthConfigured } from "@/features/developers/lib/discord-oauth";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";
import { listMyProducts } from "@/features/developers/services/developer.service";

export const metadata = { title: "Developer dashboard" };

export default async function DeveloperDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/dashboard");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");
  const products = await listMyProducts(session.user.id).catch(() => []);
  const { discord: discordStatus } = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
        <p className="mt-2 text-sm text-muted">
          Role {profile.role}
          {profile.verified ? " · Verified publisher" : " · Unverified — staff review required"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Products</CardTitle>
          <CardDescription>{products.length} listed</CardDescription>
          <Link
            href="/developers/products"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            Manage
          </Link>
        </Card>
        <Card>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Hashed at rest. Revealed once.</CardDescription>
          <Link
            href="/developers/api-keys"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Keys
          </Link>
        </Card>
        <Card>
          <CardTitle>Public page</CardTitle>
          <CardDescription>/{profile.slug}</CardDescription>
          <Link
            href={`/developers/${profile.slug}`}
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            View
          </Link>
        </Card>
      </div>

      <Card>
        <CardTitle>Discord</CardTitle>
        <CardDescription>
          Connect your Discord account to prove you control it — the first step toward Discord bot
          ownership verification (full bot-ownership proof isn&rsquo;t built yet).
        </CardDescription>
        <div className="mt-4 flex items-center gap-3">
          {profile.discordConnected ? (
            <Badge tone="success">Connected as @{profile.discordUsername}</Badge>
          ) : isDiscordOAuthConfigured() ? (
            <a
              href="/api/developers/discord/connect"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Connect Discord
            </a>
          ) : (
            <p className="text-sm text-muted">Discord connect isn&rsquo;t configured yet.</p>
          )}
          {discordStatus === "connected" ? (
            <span className="text-sm text-neon-mint">Connected!</span>
          ) : discordStatus === "error" ? (
            <span className="text-sm text-destructive">Couldn&rsquo;t connect — try again.</span>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Socials</CardTitle>
        <CardDescription>Shown on your public App Store publisher page.</CardDescription>
        <div className="mt-4">
          <SocialsForm
            twitterUrl={profile.twitterUrl}
            githubUrl={profile.githubUrl}
            youtubeUrl={profile.youtubeUrl}
            discordServerUrl={profile.discordServerUrl}
          />
        </div>
      </Card>
    </div>
  );
}
