import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      estimate: { estimatedCostCoins: "40" },
      wallet: { available: "120", reserved: "10" },
    }),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { AidenGenerateWorkspace } from "@/features/aiden/components/aiden-generate-workspace";
import { AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";

afterEach(() => {
  vi.clearAllMocks();
});

describe("Aiden generate workspace", () => {
  it("shows concept-only copy and a live estimate, not a hardcoded shop price", () => {
    render(<AidenGenerateWorkspace />);
    expect(screen.getByRole("heading", { name: /create concept image/i })).toBeInTheDocument();
    expect(screen.getByText(AIDEN_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText(/40 KOBA Coins/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm and queue/i })).toBeDisabled();
  });
});
