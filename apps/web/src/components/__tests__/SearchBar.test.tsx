import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/navigation — SearchBar uses useRouter, usePathname, useSearchParams
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
  useSearchParams: () => mockSearchParams,
}));

import { SearchBar } from "../SearchBar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSearchBar(props?: Partial<React.ComponentProps<typeof SearchBar>>) {
  return render(
    <SearchBar placeholder="Search threat actors…" {...props} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the search input", () => {
    renderSearchBar();
    const input = screen.getByRole("searchbox", {
      name: /search threat actors/i,
    });
    expect(input).toBeInTheDocument();
  });

  it("shows the provided placeholder text", () => {
    renderSearchBar({ placeholder: "Find actors…" });
    expect(screen.getByPlaceholderText("Find actors…")).toBeInTheDocument();
  });

  it("pre-fills the input with initialValue", () => {
    renderSearchBar({ initialValue: "APT28" });
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.value).toBe("APT28");
  });

  it("calls onSearch callback after debounce delay", async () => {
    const onSearch = vi.fn();
    renderSearchBar({ onSearch, debounceMs: 300 });

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "Lazarus" } });

    // Should not have fired yet
    expect(onSearch).not.toHaveBeenCalled();

    // Fast-forward past debounce
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledWith("Lazarus");
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("does not call onSearch before debounce delay elapses", () => {
    const onSearch = vi.fn();
    renderSearchBar({ onSearch, debounceMs: 300 });

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "apt" } });
    act(() => vi.advanceTimersByTime(200)); // not yet

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("resets debounce timer on each keystroke", () => {
    const onSearch = vi.fn();
    renderSearchBar({ onSearch, debounceMs: 300 });

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "L" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: "La" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: "Laz" } });
    act(() => vi.advanceTimersByTime(300));

    // Only the last value should have been emitted, once
    expect(onSearch).toHaveBeenCalledWith("Laz");
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch immediately on Enter keydown", () => {
    const onSearch = vi.fn();
    renderSearchBar({ onSearch, debounceMs: 300 });

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "APT29" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Should fire immediately without waiting for debounce
    expect(onSearch).toHaveBeenCalledWith("APT29");
  });

  it("clears the input and calls onSearch with empty string on Escape", () => {
    const onSearch = vi.fn();
    renderSearchBar({ onSearch, initialValue: "APT28" });

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("");
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("shows the clear (X) button when input has a value", () => {
    renderSearchBar({ onSearch: vi.fn(), initialValue: "Cozy Bear" });
    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();
  });

  it("hides the clear button when input is empty", () => {
    renderSearchBar({ onSearch: vi.fn(), initialValue: "" });
    expect(
      screen.queryByRole("button", { name: /clear search/i }),
    ).not.toBeInTheDocument();
  });

  it("clears the input when the X button is clicked", async () => {
    const onSearch = vi.fn();
    renderSearchBar({ onSearch, initialValue: "Fancy Bear" });

    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    fireEvent.click(clearBtn);

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("pushes to router when no onSearch is provided", () => {
    renderSearchBar({ debounceMs: 300 });

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "Carbanak" } });
    act(() => vi.advanceTimersByTime(300));

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("q=Carbanak"),
    );
  });
});
