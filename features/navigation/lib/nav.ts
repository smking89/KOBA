/** Shared primary navigation — desktop header + mobile bottom/More. */

export type NavLink = {
  href: string;
  label: string;
};

/** Always-visible desktop destinations (core product). */
export const DESKTOP_PRIMARY_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/market", label: "Market" },
  { href: "/trade", label: "Trade" },
  { href: "/servers", label: "Servers" },
  { href: "/groups", label: "Groups" },
  { href: "/feed", label: "Feed" },
  { href: "/messages", label: "Messages" },
] as const;

/** Secondary desktop destinations (overflow / utility). */
export const DESKTOP_MORE_LINKS: readonly NavLink[] = [
  { href: "/lfg", label: "LFG" },
  { href: "/aiden", label: "Aiden" },
  { href: "/plus", label: "KOBA Plus" },
  { href: "/influencer", label: "Promo" },
  { href: "/seller/promotions", label: "Campaigns" },
  { href: "/wallet", label: "Wallet" },
  { href: "/developers", label: "Developers" },
  { href: "/apps", label: "Apps" },
] as const;

/** Mobile bottom bar — keep lean; extras live under More. */
export const MOBILE_PRIMARY_HREFS = ["/", "/market", "/feed", "/messages"] as const;

export const MOBILE_MORE_LINKS: readonly NavLink[] = [
  { href: "/trade", label: "Trade" },
  { href: "/servers", label: "Servers" },
  { href: "/groups", label: "Groups" },
  { href: "/lfg", label: "LFG" },
  { href: "/aiden", label: "Aiden" },
  { href: "/plus", label: "KOBA Plus" },
  { href: "/influencer", label: "Promo" },
  { href: "/seller/promotions", label: "Campaigns" },
  { href: "/wallet", label: "Wallet" },
  { href: "/developers", label: "Developers" },
  { href: "/apps", label: "Apps" },
  { href: "/settings", label: "You" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMoreSectionActive(pathname: string): boolean {
  return MOBILE_MORE_LINKS.some((link) => isNavActive(pathname, link.href));
}
