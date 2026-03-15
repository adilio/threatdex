import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CardSkeleton } from "../CardSkeleton";

describe("CardSkeleton", () => {
  it("renders without crashing", () => {
    expect(() => render(<CardSkeleton />)).not.toThrow();
  });

  it("has aria-hidden attribute", () => {
    const { container } = render(<CardSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("has presentation role attribute", () => {
    const { container } = render(<CardSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("presentation");
  });

  it("renders card body with correct dimensions class", () => {
    const { container } = render(<CardSkeleton />);
    const cardBody = container.querySelector(".w-\\[280px\\].h-\\[392px\\]");
    expect(cardBody).not.toBeNull();
  });

  it("renders skeleton shimmer elements", () => {
    const { container } = render(<CardSkeleton />);
    const shimmerEls = container.querySelectorAll(".skeleton-shimmer");
    expect(shimmerEls.length).toBeGreaterThan(0);
  });

  it("renders 4 stat skeleton rows", () => {
    const { container } = render(<CardSkeleton />);
    // The stats grid renders 4 children [0,1,2,3]
    const statItems = container.querySelectorAll(".grid.grid-cols-2 > div");
    expect(statItems.length).toBe(4);
  });

  it("renders controls skeleton area", () => {
    const { container } = render(<CardSkeleton />);
    // The controls row has flex gap-2 with 2 skeleton divs
    const flexDivs = container.querySelectorAll(".flex.gap-2");
    expect(flexDivs.length).toBeGreaterThan(0);
  });
});
