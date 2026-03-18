import { useEffect, useState } from "react"
import { MoonStar, SunMedium } from "lucide-react"

type Theme = "light" | "dark"

const THEME_STORAGE_KEY = "threatdex-theme"

function resolveInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark"
  const theme = document.documentElement.dataset.theme
  return theme === "light" ? "light" : "dark"
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    setTheme(resolveInitialTheme())
  }, [])

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
  }

  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  )
}
