import { cn } from "@/lib/utils";

export function StoreAppIcon({
  name,
  iconUrl,
  size = 56,
  className,
}: {
  name: string;
  iconUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (iconUrl) {
    return (
      // Remote publisher-uploaded icon — arbitrary origin, same plain-<img>
      // pattern used for other user-supplied media across the app.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className={cn("rounded-[22%] object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // No uploaded icon yet — a flat monochrome tile with the app's initial
  // (client, 2026-08-17: "let's forget the gradients, and use black and
  // white color scheme"; icons stay border-free, same rule already
  // applied to every other icon treatment across the app). Just a filled
  // surface tile, no ring around it.
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[22%] bg-surface-2 font-bold text-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
