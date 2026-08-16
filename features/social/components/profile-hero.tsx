import type { CSSProperties } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KobaBadgeArt } from "@/components/koba/koba-badge-art";
import { PlusBadge } from "@/features/plus/components/plus-badge";
import { FollowButton } from "@/features/social/components/follow-button";
import { BlockButton } from "@/features/social/components/block-button";
import { MessageButton } from "@/features/messages/components/message-button";
import { ACCOUNT_TYPE_LABEL, type KobaAccountType } from "@/features/koba-id/lib/format";

export type ProfileHeroData = {
  handle: string;
  name: string;
  bio: string | null;
  image: string | null;
  createdAt: string;
  accountType: KobaAccountType;
  identities: { accountType: KobaAccountType; code: string }[];
  kobaId: string | null;
  plusBadge: boolean;
  followers: number;
  following: number;
  posts: number;
  isSelf: boolean;
  followingThem: boolean;
  blocked: boolean;
};

const ROLE_DOT: Record<KobaAccountType, string> = {
  PLAYER: "bg-neon-lime",
  BUSINESS: "bg-warning",
  INFLUENCER: "bg-neon-mint",
  SUPERADMIN: "bg-destructive",
  ADMIN: "bg-destructive",
  MODERATOR: "bg-electric-green",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function memberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function bannerStyle(handle: string, plus: boolean): CSSProperties {
  let hash = 0;
  for (const ch of handle) {
    hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  }
  const hue = hash % 360;
  if (plus) {
    return {
      background: `linear-gradient(135deg, hsl(${hue} 42% 14%) 0%, #3a2208 52%, #4a1408 100%)`,
    };
  }
  return {
    background: `linear-gradient(135deg, hsl(${hue} 16% 16%) 0%, hsl(${(hue + 38) % 360} 12% 10%) 100%)`,
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}

export function ProfileHero({
  profile,
  signedIn,
}: {
  profile: ProfileHeroData;
  signedIn: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-3 shadow-soft">
      <div className="relative h-40" style={bannerStyle(profile.handle, profile.plusBadge)}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_85%,rgba(184,255,0,0.2),transparent_58%)]" />
        {profile.plusBadge ? (
          <div className="absolute top-4 right-4">
            <KobaBadgeArt mark="plus" size={56} />
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-5 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[6px] border-surface-3 bg-brand-gradient text-2xl font-bold text-background">
            {profile.image ? (
              // User avatars may be remote https URLs (OAuth / CDN).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{initials(profile.name)}</span>
            )}
          </div>
          <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
            {profile.isSelf ? (
              <Link href="/settings" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                Edit Profile
              </Link>
            ) : (
              <>
                <FollowButton
                  handle={profile.handle}
                  signedIn={signedIn}
                  isSelf={profile.isSelf}
                  initialFollowing={profile.followingThem}
                />
                <MessageButton
                  handle={profile.handle}
                  signedIn={signedIn}
                  isSelf={profile.isSelf}
                  blocked={profile.blocked}
                />
                <BlockButton
                  handle={profile.handle}
                  signedIn={signedIn}
                  isSelf={profile.isSelf}
                  initialBlocked={profile.blocked}
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
            <PlusBadge visible={profile.plusBadge} />
          </div>
          <p className="mt-0.5 text-sm text-muted">@{profile.handle}</p>
        </div>

        <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              About me
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">
              {profile.blocked ? "This profile is blocked." : (profile.bio ?? "No bio yet.")}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                Member since
              </p>
              <p className="mt-1.5 text-sm">{memberSince(profile.createdAt)}</p>
            </div>
            {profile.kobaId ? (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                  KOBAID
                </p>
                <p className="mt-1.5 font-mono text-sm">{profile.kobaId}</p>
              </div>
            ) : null}
          </div>
        </div>

        {profile.identities.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Roles
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {profile.identities.map((identity) => (
                <li key={identity.code}>
                  <span
                    className={cn(
                      "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold",
                      identity.accountType === profile.accountType
                        ? "border-white/16 bg-white/10 text-foreground"
                        : "border-white/10 bg-white/[0.04] text-muted",
                    )}
                  >
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", ROLE_DOT[identity.accountType])}
                      aria-hidden
                    />
                    {ACCOUNT_TYPE_LABEL[identity.accountType]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-4">
            <Badge>{ACCOUNT_TYPE_LABEL[profile.accountType]}</Badge>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-black/25 px-3 py-3 text-center">
          <Stat label="Followers" value={profile.followers} />
          <Stat label="Following" value={profile.following} />
          <Stat label="Posts" value={profile.posts} />
        </dl>
      </div>
    </section>
  );
}
