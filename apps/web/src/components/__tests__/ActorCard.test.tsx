import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock html2canvas (used in download)
// ---------------------------------------------------------------------------
vi.mock("html2canvas", () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => "data:image/png;base64,abc",
  }),
}));

// ---------------------------------------------------------------------------
// Mock @threatdex/ui card components
// ---------------------------------------------------------------------------
vi.mock("@threatdex/ui", () => ({
  CardFront: ({ actor }: { actor: { canonicalName: string } }) => (
    <div data-testid="card-front">{actor.canonicalName}</div>
  ),
  CardBack: ({ actor }: { actor: { canonicalName: string } }) => (
    <div data-testid="card-back">{actor.canonicalName} back</div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock @threatdex/schema
// ---------------------------------------------------------------------------
vi.mock("@threatdex/schema", () => ({
  getRarityColor: (rarity: string) => {
    const map: Record<string, string> = {
      MYTHIC: "#FFFF00",
      LEGENDARY: "#FF0BBE",
      EPIC: "#978BFF",
      RARE: "#6197FF",
    };
    return map[rarity] ?? "#6197FF";
  },
}));

import { ActorCard } from "../ActorCard";
import type { ThreatActor } from "@/types";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const mockActor: ThreatActor = {
  id: "apt28",
  canonicalName: "APT28",
  aliases: ["Fancy Bear"],
  mitreId: "G0007",
  country: "Russia",
  countryCode: "RU",
  motivation: ["espionage"],
  threatLevel: 9,
  sophistication: "Nation-State Elite",
  firstSeen: "2004",
  lastSeen: "2024",
  sectors: ["Government"],
  geographies: ["Europe"],
  tools: ["Mimikatz"],
  ttps: [],
  campaigns: [],
  description: "GRU-linked threat actor.",
  tagline: "Russia's cyber spear.",
  rarity: "MYTHIC",
  sources: [],
  tlp: "WHITE",
  lastUpdated: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActorCard", () => {
  it("renders without crashing", () => {
    expect(() => render(<ActorCard actor={mockActor} />)).not.toThrow();
  });

  it("renders card front component by default", () => {
    render(<ActorCard actor={mockActor} />);
    expect(screen.getByTestId("card-front")).toBeInTheDocument();
  });

  it("renders card back component", () => {
    render(<ActorCard actor={mockActor} />);
    expect(screen.getByTestId("card-back")).toBeInTheDocument();
  });

  it("renders the actor canonical name label", () => {
    render(<ActorCard actor={mockActor} />);
    // The name label below the card
    expect(screen.getAllByText("APT28").length).toBeGreaterThan(0);
  });

  it("renders country label when actor has country", () => {
    render(<ActorCard actor={mockActor} />);
    expect(screen.getByText(/Russia/)).toBeInTheDocument();
  });

  it("does not render country label when actor has no country", () => {
    const noCountry = { ...mockActor, country: undefined };
    render(<ActorCard actor={noCountry} />);
    expect(screen.queryByText(/Russia/)).not.toBeInTheDocument();
  });

  it("renders View Details link pointing to actor detail page", () => {
    render(<ActorCard actor={mockActor} />);
    const link = screen.getByRole("link", { name: /view details/i });
    expect(link).toHaveAttribute("href", "/actors/apt28");
  });

  it("renders flip button", () => {
    render(<ActorCard actor={mockActor} />);
    expect(screen.getByRole("button", { name: /show card back/i })).toBeInTheDocument();
  });

  it("clicking flip button changes aria-label", () => {
    render(<ActorCard actor={mockActor} />);
    const flipBtn = screen.getByRole("button", { name: /show card back/i });
    fireEvent.click(flipBtn);
    expect(screen.getByRole("button", { name: /show card front/i })).toBeInTheDocument();
  });

  it("does NOT render download button when showDownload=false", () => {
    render(<ActorCard actor={mockActor} showDownload={false} />);
    expect(screen.queryByRole("button", { name: /download card as png/i })).not.toBeInTheDocument();
  });

  it("renders download button when showDownload=true", () => {
    render(<ActorCard actor={mockActor} showDownload={true} />);
    expect(screen.getByRole("button", { name: /download card as png/i })).toBeInTheDocument();
  });

  it("card container is keyboard accessible", () => {
    render(<ActorCard actor={mockActor} />);
    const cardContainer = screen.getByRole("button", {
      name: /apt28 card — click to see back/i,
    });
    expect(cardContainer).toBeInTheDocument();
  });

  it("clicking card container flips the card", () => {
    render(<ActorCard actor={mockActor} />);
    const cardContainer = screen.getByRole("button", {
      name: /apt28 card — click to see back/i,
    });
    fireEvent.click(cardContainer);
    expect(
      screen.getByRole("button", { name: /apt28 card — click to see front/i }),
    ).toBeInTheDocument();
  });

  it("renders country code in label", () => {
    render(<ActorCard actor={mockActor} />);
    expect(screen.getByText(/\[RU\]/)).toBeInTheDocument();
  });
});
