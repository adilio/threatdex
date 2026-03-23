import { Link } from "react-router"
import { useState } from "react"
import { BookOpen, Menu, Search, Shield, X } from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"

const GITHUB_URL = "https://github.com/adilio/threatdex"

const NAV_LINKS = [
  { href: "/#actors", label: "Browse Actors", icon: Search },
  { href: "/#sources", label: "Data Sources", icon: BookOpen },
] as const

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-app-border bg-app-nav/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="ThreatDex Home">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-wiz-blue/20 bg-wiz-blue/10 shadow-[0_0_0_1px_rgba(2,84,236,0.08)]">
            <Shield className="h-5 w-5 text-wiz-blue" strokeWidth={2.2} />
          </div>
          <div>
            <p className="font-display text-xl font-black uppercase tracking-[0.08em] text-app-text">
              <span className="text-wiz-blue">Threat</span>
              <span className="text-vibrant-pink">Dex</span>
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-muted">
              Threat Actor Index
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="dex-nav-link">
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="dex-nav-link"
          >
            <span>GitHub</span>
          </a>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="dex-icon-button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-app-border bg-app-nav/95 px-4 py-4 sm:px-6 lg:hidden">
          <div className="space-y-2">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-panel px-4 py-3 text-sm font-semibold text-app-text"
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-4 w-4 text-wiz-blue" />
                <span>{label}</span>
              </a>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-app-border bg-app-panel px-4 py-3 text-sm font-semibold text-app-text"
              onClick={() => setMobileOpen(false)}
            >
              <span>GitHub</span>
              <span className="text-app-muted">↗</span>
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
