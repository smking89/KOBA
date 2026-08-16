import { Gamepad2 } from "lucide-react";
import { SiPlaystation, SiSteam } from "react-icons/si";
import type { IconType } from "react-icons";
import { PLATFORM_LABEL, type GamePlatform } from "@/features/marketplace/lib/catalog";

// simple-icons (react-icons/si) ships real Steam and PlayStation brand
// marks; it has no Xbox or Windows/PC glyph at all (Microsoft brand
// assets aren't in that open-source set) — falling back to a generic
// controller icon for those two rather than a mislabeled substitute.
const BRAND_ICON: Partial<Record<GamePlatform, IconType>> = {
  STEAM: SiSteam,
  PLAYSTATION: SiPlaystation,
};

export function PlatformIcon({ platform, className }: { platform: GamePlatform; className?: string }) {
  const Icon = BRAND_ICON[platform] ?? Gamepad2;
  return <Icon className={className} aria-label={PLATFORM_LABEL[platform]} />;
}
