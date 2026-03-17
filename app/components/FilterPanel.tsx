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

interface FilterPanelProps {
  initialCountry?: string;
  initialMotivation?: string;
  initialRarity?: string;
  className?: string;
}

export function FilterPanel({
  initialCountry = "",
  initialMotivation = "",
  initialRarity = "",
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

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("country");
    params.delete("motivation");
    params.delete("rarity");
    params.delete("offset");
    navigate(`?${params.toString()}`);
  }, [navigate, searchParams]);

  const hasActiveFilters =
    Boolean(initialCountry) ||
    Boolean(initialMotivation) ||
    Boolean(initialRarity);

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
