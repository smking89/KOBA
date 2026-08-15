import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RustIntegrationPanel } from "@/features/servers/components/rust-integration-panel";

describe("Rust integration panel", () => {
  it("exposes accessible fields and a read-only badge", () => {
    render(<RustIntegrationPanel serverSlug="demo-rust" serverName="Demo Rust" />);
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByLabelText("Host")).toBeInTheDocument();
    expect(screen.getByLabelText("RCON port")).toBeInTheDocument();
    expect(screen.getByLabelText("RCON password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
    expect(screen.getByText(/Administrative RCON commands are disabled/i)).toBeInTheDocument();
  });

  it("never prefills a saved password", () => {
    render(
      <RustIntegrationPanel
        serverSlug="demo-rust"
        serverName="Demo Rust"
        initialHealth={{
          configured: true,
          credentialsConfigured: true,
          status: "CONNECTED",
          mode: "RCON_READ",
          readOnly: true,
          administrativeCommandsEnabled: false,
          hostname: "203.0.113.10",
          queryPort: 28015,
          rconPort: 28016,
          capabilities: ["RCON_READ", "STATUS"],
          lastTestedAt: null,
          lastSuccessfulAt: null,
          lastFailureCategory: null,
          circuitOpen: false,
          pollFailures: 0,
          freshness: {
            checkedAt: null,
            lastSuccessfulAt: null,
            freshUntil: null,
            isStale: true,
            source: "rust",
          },
          online: true,
          livePlayers: 0,
          maxPlayers: 50,
          queue: null,
          mapName: "Procedural Map",
          mapSize: null,
          serverName: "Demo",
          serverTags: null,
          rustVersion: null,
          notices: [],
        }}
      />,
    );
    expect(screen.getByText("Credentials configured.")).toBeInTheDocument();
    const passwordFields = screen.getAllByLabelText("RCON password") as HTMLInputElement[];
    expect(passwordFields.every((field) => field.value === "")).toBe(true);
  });
});
