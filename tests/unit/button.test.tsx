import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders primary label", () => {
    render(<Button>Buy Now</Button>);
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeInTheDocument();
  });
});
