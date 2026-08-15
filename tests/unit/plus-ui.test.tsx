import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlusBadge } from "@/features/plus/components/plus-badge";
import { PlusMembershipPanel } from "@/features/plus/components/plus-membership-panel";
import { MOCK_PLUS_SUBSCRIPTION, type PlusSubscriptionView } from "@/features/plus/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubPlusFetch(payload: PlusSubscriptionView = MOCK_PLUS_SUBSCRIPTION) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }),
  );
}

describe("Plus badge", () => {
  it("renders accessible text, not colour alone", () => {
    const { container } = render(<PlusBadge visible />);
    expect(screen.getByText("KOBA Plus")).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
  });

  it("does not render when entitlement is missing", () => {
    const { container } = render(<PlusBadge visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Plus membership panel", () => {
  const plans = [
    {
      code: "KOBA_PLUS_MONTHLY",
      displayName: "KOBA Plus Monthly",
      interval: "MONTHLY" as const,
      priceLabel: "USD 7.99 / month",
      active: true,
      configured: true,
    },
    {
      code: "KOBA_PLUS_ANNUAL",
      displayName: "KOBA Plus Annual",
      interval: "ANNUAL" as const,
      priceLabel: "USD 71.88 / year",
      active: true,
      configured: true,
    },
  ];

  it("shows monthly and annual actions and coming-later benefits", () => {
    stubPlusFetch();
    render(<PlusMembershipPanel initial={MOCK_PLUS_SUBSCRIPTION} plans={plans} signedIn />);
    expect(screen.getByRole("button", { name: /monthly/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annual/i })).toBeInTheDocument();
    expect(screen.getAllByText("Coming later").length).toBeGreaterThan(0);
    expect(screen.getByText(/Security, moderation/i)).toBeInTheDocument();
  });

  it("shows past-due manage billing and processing copy", () => {
    stubPlusFetch();
    render(
      <PlusMembershipPanel
        initial={{
          ...MOCK_PLUS_SUBSCRIPTION,
          state: "PAST_DUE",
          displayState: "PAST_DUE",
          publicRef: "KOBA-PLS-TEST",
          hasBillingCustomer: true,
        }}
        plans={plans}
        signedIn
      />,
    );
    expect(screen.getByText("Past due")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
  });

  it("shows processing until webhook verification", () => {
    stubPlusFetch({ ...MOCK_PLUS_SUBSCRIPTION, processing: true });
    render(
      <PlusMembershipPanel
        initial={{ ...MOCK_PLUS_SUBSCRIPTION, processing: true }}
        plans={plans}
        signedIn
        checkoutHint="processing"
      />,
    );
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText(/verified Stripe webhook/i)).toBeInTheDocument();
  });
});
