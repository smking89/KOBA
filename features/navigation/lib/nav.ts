/** Shared primary navigation — rail, sidebar, and mobile. */

export type NavLink = {
  href: string;
  label: string;
};

export type NavSection = {
  label: string;
  links: readonly NavLink[];
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
  { href: "/enter", label: "Dashboard" },
] as const;

/** Discord-style icon rail (host shortcuts). */
export const RAIL_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/market", label: "Market" },
  { href: "/servers", label: "Servers" },
  { href: "/groups", label: "Groups" },
  { href: "/feed", label: "Feed" },
  { href: "/messages", label: "Messages" },
] as const;

/** Discord-style channel groups. */
export const SIDEBAR_SECTIONS: readonly NavSection[] = [
  {
    label: "Community",
    links: [
      { href: "/", label: "Home" },
      { href: "/enter", label: "Dashboard" },
      { href: "/feed", label: "Feed" },
      { href: "/messages", label: "Messages" },
      { href: "/groups", label: "Groups" },
      { href: "/lfg", label: "LFG" },
    ],
  },
  {
    label: "Marketplace",
    links: [
      { href: "/market", label: "Market" },
      { href: "/trade", label: "Trade" },
      { href: "/servers", label: "Servers" },
      { href: "/apps", label: "Apps" },
    ],
  },
  {
    label: "Studio",
    links: [
      { href: "/aiden", label: "Aiden" },
      { href: "/plus", label: "KOBA Plus" },
      { href: "/wallet", label: "Wallet" },
      { href: "/developers", label: "Developers" },
      { href: "/influencer", label: "Promo" },
      { href: "/seller/promotions", label: "Campaigns" },
    ],
  },
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
  { href: "/enter", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/settings", label: "You" },
] as const;

const TITLE_LINKS: readonly NavLink[] = [
  ...SIDEBAR_SECTIONS.flatMap((section) => section.links),
  { href: "/enter", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/orders", label: "Orders" },
  { href: "/admin", label: "Staff" },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMoreSectionActive(pathname: string): boolean {
  return MOBILE_MORE_LINKS.some((link) => isNavActive(pathname, link.href));
}

export function navLabelForPath(pathname: string): string {
  if (pathname.startsWith("/u/")) {
    const handle = pathname.split("/")[2];
    return handle ? `@${handle}` : "Profile";
  }
  const match = TITLE_LINKS.filter((link) => isNavActive(pathname, link.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match?.label ?? "KOBA";
}
