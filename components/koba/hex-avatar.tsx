import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABEL, type KobaAccountType } from "@/features/koba-id/lib/format";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

const ROLE_PIP: Record<KobaAccountType, string> = {
  PLAYER: "bg-neon-lime",
  BUSINESS: "bg-warning",
  INFLUENCER: "bg-neon-mint",
  SUPERADMIN: "bg-destructive",
  ADMIN: "bg-destructive",
  MODERATOR: "bg-electric-green",
};

const SIZE = {
  xs: {
    box: "h-8 w-8",
    text: "text-[0.65rem]",
    gap: "inset-[2px]",
    photo: "inset-[4px]",
    pip: "right-0 bottom-0 h-2 w-2 border-2",
  },
  sm: {
    box: "h-12 w-12",
    text: "text-sm",
    gap: "inset-[3px]",
    photo: "inset-[6px]",
    pip: "right-0 bottom-0 h-2.5 w-2.5 border-2",
  },
  md: {
    box: "h-16 w-16",
    text: "text-xl",
    gap: "inset-[3px]",
    photo: "inset-[7px]",
    pip: "right-0 bottom-0 h-3.5 w-3.5 border-[3px]",
  },
  lg: {
    box: "h-[7.5rem] w-[7.5rem]",
    text: "text-3xl",
    gap: "inset-[3px]",
    photo: "inset-[9px]",
    pip: "right-[4%] bottom-[10%] h-5 w-5 border-[3px]",
  },
} as const;

/**
 * Profile avatar with an HTB-style hex frame and a Discord-style
 * surround: colored outer ring, charcoal gap, clipped photo, role pip.
 */
export function HexAvatar({
  name,
  image = null,
  size = "md",
  plus = false,
  accountType,
  className,
}: {
  name: string;
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  plus?: boolean;
  accountType?: KobaAccountType;
  className?: string;
}) {
  const { box, text, gap, photo, pip } = SIZE[size];
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("relative shrink-0", box, className)}>
      <div
        className="absolute inset-0"
        style={{
          filter: plus
            ? "drop-shadow(0 0 12px rgba(184, 255, 0, 0.55))"
            : "drop-shadow(0 0 8px rgba(184, 255, 0, 0.16))",
        }}
      >
        <div
          className={cn("h-full w-full", plus ? "bg-brand-gradient" : "bg-white/22")}
          style={{ clipPath: HEX_CLIP }}
        />
      </div>
      <div className={cn("absolute bg-surface-3", gap)} style={{ clipPath: HEX_CLIP }} />
      <div
        className={cn(
          "absolute flex items-center justify-center overflow-hidden bg-surface-2 font-bold text-neon-lime",
          photo,
          text,
        )}
        style={{ clipPath: HEX_CLIP }}
      >
        {image ? (
          // User avatars may be remote https URLs (OAuth / CDN).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
      </div>
      {accountType ? (
        <span
          className={cn("absolute rounded-full border-surface-3", pip, ROLE_PIP[accountType])}
          title={ACCOUNT_TYPE_LABEL[accountType]}
          aria-label={ACCOUNT_TYPE_LABEL[accountType]}
        />
      ) : null}
    </div>
  );
}
