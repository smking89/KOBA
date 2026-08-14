import { describe, expect, it } from "vitest";
import {
  DESKTOP_MORE_LINKS,
  DESKTOP_PRIMARY_LINKS,
  isMoreSectionActive,
  isNavActive,
  MOBILE_MORE_LINKS,
  MOBILE_PRIMARY_HREFS,
} from "@/features/navigation/lib/nav";
import { sameRarityTier, tradeStateLabel } from "@/features/trade/lib/types";
import { MOCK_TRADES } from "@/features/trade/lib/catalog";
import {
  canConnectGameServer,
  hasCapability,
  rconTestLabel,
  visiblePlayerCount,
} from "@/features/servers/lib/types";
import { MOCK_SERVERS } from "@/features/servers/lib/catalog";
import { plusStateLabel, PLUS_BENEFITS } from "@/features/plus/lib/types";
import { aidenJobLabel, aidenTechnicalLabel, AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";
import { MOCK_AIDEN_LIBRARY } from "@/features/aiden/lib/catalog";
import { coinCategoryLabel } from "@/features/wallet/lib/types";
import { isProtectedPath } from "@/lib/auth/protected-routes";

describe("expansion navigation", () => {
  it("keeps mobile primary lean and parks Trade/Servers/Aiden/Plus under More", () => {
    expect(MOBILE_PRIMARY_HREFS).toEqual(["/", "/market", "/feed", "/messages"]);
    expect(MOBILE_MORE_LINKS.map((link) => link.href)).toEqual(
      expect.arrayContaining(["/trade", "/servers", "/aiden", "/plus", "/wallet", "/developers"]),
    );
    expect(DESKTOP_PRIMARY_LINKS.some((link) => link.href === "/trade")).toBe(true);
    expect(DESKTOP_MORE_LINKS.some((link) => link.href === "/aiden")).toBe(true);
    expect(isNavActive("/trade/KOBA-TRD-DEMO0001", "/trade")).toBe(true);
    expect(isMoreSectionActive("/aiden/generate")).toBe(true);
  });
});

describe("trade rarity presentation", () => {
  it("only allows same-rarity tiers", () => {
    expect(sameRarityTier([{ rarity: "EPIC" }], [{ rarity: "EPIC" }])).toBe(true);
    expect(sameRarityTier([{ rarity: "EPIC" }], [{ rarity: "RELIC" }])).toBe(false);
    expect(sameRarityTier([], [{ rarity: "EPIC" }])).toBe(false);
  });

  it("renders known trade states", () => {
    expect(tradeStateLabel("PENDING")).toBe("Pending");
    expect(tradeStateLabel("DISPUTED")).toBe("Disputed");
    expect(MOCK_TRADES.some((trade) => trade.state === "PENDING")).toBe(true);
  });
});

describe("servers and RCON roles", () => {
  it("restricts connect to Business and Influencer", () => {
    expect(canConnectGameServer("BUSINESS")).toBe(true);
    expect(canConnectGameServer("INFLUENCER")).toBe(true);
    expect(canConnectGameServer("PLAYER")).toBe(false);
    expect(canConnectGameServer(null)).toBe(false);
  });

  it("never invents player counts without capability", () => {
    const consoleServer = MOCK_SERVERS.find((server) => server.slug === "console-dayz-eu")!;
    expect(hasCapability(consoleServer, "PLAYER_COUNT")).toBe(false);
    expect(visiblePlayerCount(consoleServer)).toBeNull();
    expect(rconTestLabel("AUTH_FAILED")).toBe("Authentication failed");
  });
});

describe("plus, aiden, wallet contracts", () => {
  it("keeps security benefits on free tier", () => {
    const security = PLUS_BENEFITS.find((benefit) => benefit.id === "security");
    expect(security?.free).toBe(true);
    expect(plusStateLabel("ACTIVE")).toBe("Active");
    expect(plusStateLabel("PAST_DUE")).toBe("Past due");
    expect(plusStateLabel("CANCELLED")).toBe("Cancelled");
    expect(plusStateLabel("EXPIRED")).toBe("Expired");
  });

  it("exposes technical statuses and disclaimer", () => {
    expect(AIDEN_DISCLAIMER.toLowerCase()).toContain("not automatically");
    expect(aidenTechnicalLabel("CONCEPT_ONLY")).toBe("Concept only");
    expect(aidenTechnicalLabel("GAME_READY")).toBe("Game-ready");
    expect(aidenTechnicalLabel("VALIDATION_FAILED")).toBe("Validation failed");
    expect(aidenJobLabel("QUEUED")).toBe("Queued");
    expect(aidenJobLabel("PROCESSING")).toBe("Processing");
    expect(aidenJobLabel("FAILED")).toBe("Failed");
    expect(MOCK_AIDEN_LIBRARY.every((asset) => asset.technicalStatus)).toBeTruthy();
  });

  it("models coin buckets without a mutable user.balance field", () => {
    expect(coinCategoryLabel("PURCHASE")).toBe("Purchase");
    expect(coinCategoryLabel("REFUND")).toBe("Refund");
    expect(coinCategoryLabel("SELLER_EARNING")).toBe("Seller Earning");
    expect(coinCategoryLabel("PLATFORM_FEE")).toBe("Platform Fee");
    expect(coinCategoryLabel("GENERATION_RESERVATION")).toBe("Generation Reservation");
    expect(coinCategoryLabel("PROMOTIONAL_GRANT")).toBe("Promotional Grant");
    expect(isProtectedPath("/wallet")).toBe(true);
    expect(isProtectedPath("/servers/connect")).toBe(true);
  });
});

describe("trade state coverage", () => {
  it("covers pending, completed, expired, and disputed presentation labels", () => {
    for (const state of ["PENDING", "COMPLETED", "EXPIRED", "DISPUTED", "CANCELLED"] as const) {
      expect(tradeStateLabel(state).length).toBeGreaterThan(0);
    }
  });
});
