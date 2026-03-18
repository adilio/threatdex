import { useState, useEffect, useRef, useCallback } from "react"
import type { ChangeEvent, KeyboardEvent } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Search, X } from "lucide-react"
import clsx from "clsx"

interface SearchBarProps {
  initialValue?: string
  placeholder?: string
  onSearch?: (value: string) => void
  debounceMs?: number
  className?: string
}

export function SearchBar({
  initialValue = "",
  placeholder = "Search threat actors…",
  onSearch,
  debounceMs = 300,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const commitSearch = useCallback(
    (query: string) => {
      if (onSearch) {
        onSearch(query)
        return
      }

      const params = new URLSearchParams(searchParams.toString())
      if (query) {
        params.set("q", query)
      } else {
        params.delete("q")
      }
      params.delete("offset")
      navigate(`?${params.toString()}`)
    },
    [navigate, onSearch, searchParams],
  )

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value
      setValue(nextValue)

      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        commitSearch(nextValue)
      }, debounceMs)
    },
    [commitSearch, debounceMs],
  )

  const handleClear = useCallback(() => {
    setValue("")
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    commitSearch("")
  }, [commitSearch])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        commitSearch(value)
      }

      if (event.key === "Escape") {
        handleClear()
      }
    },
    [commitSearch, handleClear, value],
  )

  return (
    <div className={clsx("dex-panel relative mx-auto w-full max-w-4xl", className)}>
      <Search
        className={clsx(
          "pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors",
          focused ? "text-wiz-blue" : "text-app-muted",
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
          "w-full rounded-[1.75rem] border border-transparent bg-transparent py-5 pl-14 pr-12 text-base text-app-text outline-none transition-all duration-200 placeholder:text-app-muted",
          focused && "ring-2 ring-wiz-blue/15",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-app-border bg-app-chip p-2 text-app-muted transition-colors hover:text-app-text"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
