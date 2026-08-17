import { cn } from "@/lib/utils";

// A small fixed palette of gradient pairs, picked deterministically from
// the app's name so the same app always gets the same fallback tile
// (no real icon uploaded yet) instead of a random color on every render.
const GRADIENTS = [
  ["#6a5cff", "#ff5a8c"],
  ["#1fbf6c", "#0ea5a4"],
  ["#ff5a1f", "#ffb627"],
  ["#3b82f6", "#8b5cf6"],
  ["#f5576c", "#f093fb"],
  ["#0ea5a4", "#38bdf8"],
] as const;

function pickGradient(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length]!;
}

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

  const [from, to] = pickGradient(name);
  return (
    <div
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-[22%] font-bold text-white", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.42,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
