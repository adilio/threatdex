import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { X, SlidersHorizontal } from "lucide-react";
import type { Motivation, Rarity } from "~/schema";
import clsx from "clsx";

const MOTIVATIONS: { value: Motivation; label: string }[] = [
  { value: "espionage", label: "Espionage" },
  { value: "financial", label: "Financial" },
  { value: "sabotage", label: "Sabotage" },
  { value: "hacktivism", label: "Hacktivism" },
  { value: "military", label: "Military" },
];

const RARITIES: { value: Rarity; label: string; color: string }[] = [
  { value: "MYTHIC", label: "Mythic", color: "#FFFF00" },
  { value: "LEGENDARY", label: "Legendary", color: "#FF0BBE" },
  { value: "EPIC", label: "Epic", color: "#978BFF" },
  { value: "RARE", label: "Rare", color: "#6197FF" },
];

// Phase 4.4: Source filter options
const SOURCES: { value: string; label: string }[] = [
  { value: "mitre", label: "MITRE" },
  { value: "etda", label: "ETDA" },
  { value: "otx", label: "OTX" },
  { value: "manual", label: "Manual" },
];

interface FilterPanelProps {
  initialCountry?: string;
  initialMotivation?: string;
  initialRarity?: string;
  initialSource?: string;
  initialVerified?: string;
  className?: string;
}

export function FilterPanel({
  initialCountry = "",
  initialMotivation = "",
  initialRarity = "",
  initialSource = "",
  initialVerified = "true",
  className,
}: FilterPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("offset");
      navigate(`?${params.toString()}`);
    },
    [navigate, searchParams],
  );

  const toggleMotivation = useCallback(
    (motivation: Motivation) => {
      const current = initialMotivation;
      const next = current === motivation ? "" : motivation;
      updateParam("motivation", next);
    },
    [initialMotivation, updateParam],
  );

  // Phase 4.2: Toggle verified filter
  const toggleVerified = useCallback(() => {
    const current = initialVerified === "true";
    const next = !current;
    updateParam("verified", next ? "true" : "false");
  }, [initialVerified, updateParam]);

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("country");
    params.delete("motivation");
    params.delete("rarity");
    params.delete("source");
    params.delete("offset");
    // Don't clear verified - it has a default
    navigate(`?${params.toString()}`);
  }, [navigate, searchParams]);

  const hasActiveFilters =
    Boolean(initialCountry) ||
    Boolean(initialMotivation) ||
    Boolean(initialRarity) ||
    Boolean(initialSource);

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-3",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-sky-blue/50 font-semibold uppercase tracking-wider">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filters
      </div>

      {/* Country free-text filter */}
      <input
        type="text"
        value={initialCountry}
        onChange={(e) => updateParam("country", e.target.value)}
        placeholder="Country…"
        aria-label="Filter by country"
        className="px-3 py-1.5 bg-blue-shadow/20 border border-blue-shadow hover:border-sky-blue/50 focus:border-wiz-blue focus:ring-1 focus:ring-wiz-blue/20 rounded-lg text-xs text-cloudy-white placeholder-sky-blue/40 outline-none transition-colors w-32"
      />

      {/* Motivation chips */}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter by motivation"
      >
        {MOTIVATIONS.map(({ value, label }) => {
          const active = initialMotivation === value;
          return (
            <button
              key={value}
              onClick={() => toggleMotivation(value)}
              aria-pressed={active}
              className={clsx(
                "px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide transition-all border",
                active
                  ? "bg-wiz-blue border-wiz-blue text-white"
                  : "bg-blue-shadow/20 border-blue-shadow/60 text-sky-blue/70 hover:border-sky-blue hover:text-cloudy-white",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Phase 4.4: Source filter */}
      <select
        value={initialSource}
        onChange={(e) => updateParam("source", e.target.value)}
        aria-label="Filter by source"
        className="px-3 py-1.5 bg-blue-shadow/20 border border-blue-shadow hover:border-sky-blue/50 focus:border-wiz-blue focus:ring-1 focus:ring-wiz-blue/20 rounded-lg text-xs text-cloudy-white outline-none transition-colors appearance-none cursor-pointer"
      >
        <option value="" className="bg-serious-blue text-cloudy-white">
          All Sources
        </option>
        {SOURCES.map(({ value, label }) => (
          <option key={value} value={value} className="bg-serious-blue">
            {label}
          </option>
        ))}
      </select>

      {/* Phase 4.2: Verified toggle (default on) */}
      <button
        onClick={toggleVerified}
        aria-pressed={initialVerified === "true"}
        className={clsx(
          "px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide transition-all border flex items-center gap-1.5",
          initialVerified === "true"
            ? "bg-emerald-600/30 border-emerald-500 text-emerald-400"
            : "bg-blue-shadow/20 border-blue-shadow/60 text-sky-blue/70 hover:border-sky-blue hover:text-cloudy-white",
        )}
        title="Show only actors verified across multiple sources"
      >
        <svg
          className={clsx("w-3.5 h-3.5", initialVerified === "true" && "fill-current")}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M10 2L3 7V11C3 14.8665 6.13401 18 10 18C13.866 18 17 14.8665 17 11V7L10 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7 10L9 12L13 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={initialVerified === "true" ? "block" : "hidden"}
          />
        </svg>
        Verified
      </button>

      {/* Rarity select */}
      <select
        value={initialRarity}
        onChange={(e) => updateParam("rarity", e.target.value)}
        aria-label="Filter by rarity"
        className="px-3 py-1.5 bg-blue-shadow/20 border border-blue-shadow hover:border-sky-blue/50 focus:border-wiz-blue focus:ring-1 focus:ring-wiz-blue/20 rounded-lg text-xs text-cloudy-white outline-none transition-colors appearance-none cursor-pointer"
        style={{
          color: initialRarity
            ? RARITIES.find((r) => r.value === initialRarity)?.color ??
              "#FFFFFF"
            : undefined,
        }}
      >
        <option value="" className="bg-serious-blue text-cloudy-white">
          All Rarities
        </option>
        {RARITIES.map(({ value, label, color }) => (
          <option
            key={value}
            value={value}
            className="bg-serious-blue"
            style={{ color }}
          >
            {label}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-pink-shadow hover:text-vibrant-pink border border-pink-shadow/40 hover:border-vibrant-pink/60 rounded-lg transition-colors"
          aria-label="Clear all filters"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
}
