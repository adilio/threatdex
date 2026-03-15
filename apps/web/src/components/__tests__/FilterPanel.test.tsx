import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
  useSearchParams: () => mockSearchParams,
}));

import { FilterPanel } from "../FilterPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFilterPanel(props?: React.ComponentProps<typeof FilterPanel>) {
  return render(<FilterPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FilterPanel", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the Filters label", () => {
    renderFilterPanel();
    expect(screen.getByText(/filters/i)).toBeInTheDocument();
  });

  it("renders country input field", () => {
    renderFilterPanel();
    expect(screen.getByRole("textbox", { name: /filter by country/i })).toBeInTheDocument();
  });

  it("pre-fills country input with initialCountry prop", () => {
    renderFilterPanel({ initialCountry: "Russia" });
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Russia");
  });

  it("renders all 5 motivation buttons", () => {
    renderFilterPanel();
    const motivations = ["Espionage", "Financial", "Sabotage", "Hacktivism", "Military"];
    for (const m of motivations) {
      expect(screen.getByRole("button", { name: m })).toBeInTheDocument();
    }
  });

  it("renders rarity select", () => {
    renderFilterPanel();
    expect(screen.getByRole("combobox", { name: /filter by rarity/i })).toBeInTheDocument();
  });

  it("renders rarity options including all tiers", () => {
    renderFilterPanel();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain("MYTHIC");
    expect(options).toContain("LEGENDARY");
    expect(options).toContain("EPIC");
    expect(options).toContain("RARE");
    expect(options).toContain(""); // "All Rarities"
  });

  it("motivation button shows as active when matching initialMotivation", () => {
    renderFilterPanel({ initialMotivation: "espionage" });
    const btn = screen.getByRole("button", { name: /espionage/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("inactive motivation buttons have aria-pressed=false", () => {
    renderFilterPanel({ initialMotivation: "espionage" });
    const financialBtn = screen.getByRole("button", { name: /financial/i });
    expect(financialBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking motivation updates URL params", () => {
    renderFilterPanel({ initialMotivation: "" });
    const btn = screen.getByRole("button", { name: /financial/i });
    fireEvent.click(btn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("motivation=financial"));
  });

  it("clicking active motivation deselects it (removes param)", () => {
    renderFilterPanel({ initialMotivation: "espionage" });
    const btn = screen.getByRole("button", { name: /espionage/i });
    fireEvent.click(btn);
    // Should push without motivation param
    const pushArg = mockPush.mock.calls[0][0] as string;
    expect(pushArg).not.toContain("motivation=espionage");
  });

  it("changing country input updates URL", () => {
    renderFilterPanel({ initialCountry: "" });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "China" } });
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("country=China"));
  });

  it("selecting rarity updates URL", () => {
    renderFilterPanel();
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "MYTHIC" } });
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("rarity=MYTHIC"));
  });

  it("does NOT show clear button when no filters active", () => {
    renderFilterPanel({ initialCountry: "", initialMotivation: "", initialRarity: "" });
    expect(screen.queryByRole("button", { name: /clear all filters/i })).not.toBeInTheDocument();
  });

  it("shows clear button when country filter is active", () => {
    renderFilterPanel({ initialCountry: "Russia" });
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("shows clear button when motivation filter is active", () => {
    renderFilterPanel({ initialMotivation: "espionage" });
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("shows clear button when rarity filter is active", () => {
    renderFilterPanel({ initialRarity: "MYTHIC" });
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("clicking clear removes all filter params from URL", () => {
    renderFilterPanel({ initialCountry: "Russia", initialMotivation: "espionage", initialRarity: "MYTHIC" });
    const clearBtn = screen.getByRole("button", { name: /clear all filters/i });
    fireEvent.click(clearBtn);
    const pushArg = mockPush.mock.calls[0][0] as string;
    expect(pushArg).not.toContain("country=");
    expect(pushArg).not.toContain("motivation=");
    expect(pushArg).not.toContain("rarity=");
  });

  it("accepts optional className prop", () => {
    const { container } = renderFilterPanel({ className: "my-custom-class" });
    expect(container.firstChild).toHaveClass("my-custom-class");
  });
});
