import { useCallback, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { X, SlidersHorizontal, ChevronDown } from "lucide-react"
import type { Motivation, Rarity } from "~/schema"
import clsx from "clsx"

const MOTIVATIONS: { value: Motivation; label: string }[] = [
  { value: "espionage", label: "Espionage" },
  { value: "financial", label: "Financial" },
  { value: "sabotage", label: "Sabotage" },
  { value: "hacktivism", label: "Hacktivism" },
  { value: "military", label: "Military" },
]

const RARITIES: { value: Rarity; label: string; color: string }[] = [
  { value: "MYTHIC", label: "Mythic", color: "#665700" },
  { value: "LEGENDARY", label: "Legendary", color: "#A10B6E" },
  { value: "EPIC", label: "Epic", color: "#173AAA" },
  { value: "RARE", label: "Rare", color: "#0254EC" },
]

interface FilterPanelProps {
  initialCountry?: string
  initialMotivation?: string
  initialRarity?: string
  initialSort?: string
  className?: string
}

export function FilterPanel({
  initialCountry = "",
  initialMotivation = "",
  initialRarity = "",
  initialSort = "threat_desc",
  className,
}: FilterPanelProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const hasActiveFilters =
    Boolean(initialCountry) ||
    Boolean(initialMotivation) ||
    Boolean(initialRarity) ||
    initialSort !== "threat_desc"

  const activeFilterCount =
    [initialCountry, initialMotivation, initialRarity].filter(Boolean).length +
    (initialSort !== "threat_desc" ? 1 : 0)

  const [open, setOpen] = useState(hasActiveFilters)

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("offset")
      navigate(`?${params.toString()}`)
    },
    [navigate, searchParams],
  )

  const toggleMotivation = useCallback(
    (motivation: Motivation) => {
      const nextMotivation = initialMotivation === motivation ? "" : motivation
      updateParam("motivation", nextMotivation)
    },
    [initialMotivation, updateParam],
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("country")
    params.delete("motivation")
    params.delete("rarity")
    params.delete("sort")
    params.delete("offset")
    navigate(`?${params.toString()}`)
  }, [navigate, searchParams])

  return (
    <div className={clsx("dex-panel flex flex-col gap-0 px-4 py-3", className)}>
      {/* Always-visible row: toggle + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={clsx(
            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
            open || hasActiveFilters
              ? "border-wiz-blue bg-wiz-blue/10 text-wiz-blue"
              : "border-app-border bg-app-chip text-app-muted hover:text-app-text",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-wiz-blue text-[9px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={clsx(
              "h-3 w-3 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>

        <select
          value={initialSort}
          onChange={(event) => updateParam("sort", event.target.value)}
          aria-label="Sort actors"
          className="rounded-full border border-app-border bg-app-panel px-4 py-2.5 text-sm text-app-text outline-none"
        >
          <option value="threat_desc">Biggest threats</option>
          <option value="recent_desc">Most recent activity</option>
          <option value="updated_desc">Recently updated</option>
          <option value="name_asc">Name A-Z</option>
        </select>

        {hasActiveFilters && !open && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-app-muted transition-colors hover:text-app-text"
            aria-label="Clear all filters"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Collapsible filter controls */}
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-app-border pt-3">
          <input
            type="text"
            value={initialCountry}
            onChange={(event) => updateParam("country", event.target.value.toUpperCase())}
            placeholder="Country code"
            aria-label="Filter by country"
            className="rounded-full border border-app-border bg-app-panel px-4 py-2.5 text-sm text-app-text outline-none placeholder:text-app-muted"
          />

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by motivation">
            {MOTIVATIONS.map(({ value, label }) => {
              const active = initialMotivation === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleMotivation(value)}
                  aria-pressed={active}
                  className={clsx(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all",
                    active
                      ? "border-wiz-blue bg-wiz-blue text-white"
                      : "border-app-border bg-app-panel text-app-muted hover:text-app-text",
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <select
            value={initialRarity}
            onChange={(event) => updateParam("rarity", event.target.value)}
            aria-label="Filter by rarity"
            className="rounded-full border border-app-border bg-app-panel px-4 py-2.5 text-sm text-app-text outline-none"
            style={{
              color: initialRarity
                ? RARITIES.find((rarity) => rarity.value === initialRarity)?.color
                : undefined,
            }}
          >
            <option value="">All rarities</option>
            {RARITIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-panel px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-app-muted transition-colors hover:text-app-text"
              aria-label="Clear all filters"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
