"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import clsx from "clsx";

interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  onSearch?: (value: string) => void;
  /** Debounce delay in ms. Defaults to 300. */
  debounceMs?: number;
  className?: string;
}

export function SearchBar({
  initialValue = "",
  placeholder = "Search threat actors…",
  onSearch,
  debounceMs = 300,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Keep local value in sync with URL-driven initialValue changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const commitSearch = useCallback(
    (query: string) => {
      if (onSearch) {
        onSearch(query);
        return;
      }
      // Default: push to URL search params
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }
      // Reset pagination when search changes
      params.delete("offset");
      router.push(`${pathname}?${params.toString()}`);
    },
    [onSearch, router, pathname, searchParams],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        commitSearch(next);
      }, debounceMs);
    },
    [commitSearch, debounceMs],
  );

  const handleClear = useCallback(() => {
    setValue("");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    commitSearch("");
  }, [commitSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        commitSearch(value);
      }
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [commitSearch, handleClear, value],
  );

  return (
    <div
      className={clsx(
        "relative flex items-center w-full max-w-2xl mx-auto",
        className,
      )}
    >
      <Search
        className={clsx(
          "absolute left-4 w-4 h-4 pointer-events-none transition-colors",
          focused ? "text-wiz-blue" : "text-sky-blue/50",
        )}
      />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label="Search threat actors"
        className={clsx(
          "w-full pl-11 pr-10 py-3 rounded-xl text-sm font-sans",
          "bg-blue-shadow/20 border transition-all duration-200 outline-none",
          "text-cloudy-white placeholder-sky-blue/40",
          "focus:bg-blue-shadow/30",
          focused
            ? "border-wiz-blue ring-2 ring-wiz-blue/20"
            : "border-blue-shadow hover:border-sky-blue/50",
        )}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 p-1 text-sky-blue/50 hover:text-cloudy-white transition-colors rounded"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
