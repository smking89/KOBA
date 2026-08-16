import Image from "next/image";
import { cn } from "@/lib/utils";

const art = {
  plus: { src: "/brand/badge-plus.png", label: "KOBA Plus" },
  charge: { src: "/brand/badge-charge.png", label: "KOBA" },
} as const;

type KobaBadgeArtProps = {
  mark?: keyof typeof art;
  size?: number;
  className?: string;
};

export function KobaBadgeArt({ mark = "plus", size = 20, className }: KobaBadgeArtProps) {
  const asset = art[mark];
  return (
    <Image
      src={asset.src}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 object-contain mix-blend-screen", className)}
      style={{ width: size, height: size }}
    />
  );
}
