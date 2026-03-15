import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/link and next/navigation
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { Navigation } from "../Navigation";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Navigation", () => {
  it("renders the ThreatDex logo link", () => {
    render(<Navigation />);
    const logoLink = screen.getByRole("link", { name: /threatdex home/i });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders Threat + Dex brand text", () => {
    render(<Navigation />);
    expect(screen.getByText("Threat")).toBeInTheDocument();
    expect(screen.getByText("Dex")).toBeInTheDocument();
  });

  it("renders Browse Actors navigation link", () => {
    render(<Navigation />);
    const browseLinks = screen.getAllByRole("link", { name: /browse actors/i });
    expect(browseLinks.length).toBeGreaterThan(0);
  });

  it("renders Data Sources navigation link", () => {
    render(<Navigation />);
    const sourceLinks = screen.getAllByText(/data sources/i);
    expect(sourceLinks.length).toBeGreaterThan(0);
  });

  it("renders GitHub external link", () => {
    render(<Navigation />);
    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
  });

  it("renders BETA badge", () => {
    render(<Navigation />);
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });

  it("renders mobile menu toggle button", () => {
    render(<Navigation />);
    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    expect(menuBtn).toBeInTheDocument();
  });

  it("mobile menu starts closed", () => {
    render(<Navigation />);
    // Mobile menu links (Browse Actors in the dropdown) should not be visible initially
    // The button should show aria-expanded=false
    const menuBtn = screen.getByRole("button");
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking mobile menu button opens the dropdown", () => {
    render(<Navigation />);
    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("mobile menu shows close button when open", () => {
    render(<Navigation />);
    const openBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(openBtn);
    expect(screen.getByRole("button", { name: /close menu/i })).toBeInTheDocument();
  });

  it("clicking close button collapses mobile menu", () => {
    render(<Navigation />);
    // Open first
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    // Now close
    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("renders as a nav element", () => {
    render(<Navigation />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
