import { Link } from "react-router";
import { useState } from "react";
import { Menu, X, Search, Shield } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { WizStar } from "./WizStar";

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="site-nav sticky top-0 z-50 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group"
            aria-label="ThreatDex Home"
          >
            <Shield
              className="w-6 h-6 text-wiz-blue group-hover:text-sky-blue transition-colors"
              strokeWidth={2}
            />
            <span className="text-xl font-bold tracking-tight">
              <span className="brand-threat">Threat</span>
              <span className="brand-dex">Dex</span>
            </span>
            <WizStar
              size={10}
              className="text-purplish-pink opacity-80 transition-opacity group-hover:opacity-100"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-5">
            <Link
              to="/"
              className="text-sm text-sky-blue/70 hover:text-wiz-blue transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Browse Actors
            </Link>
            <Link
              to="/sources"
              className="text-sm text-sky-blue/70 hover:text-wiz-blue transition-colors"
            >
              Data Sources
            </Link>
            <a
              href="https://github.com/threatdex"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sky-blue/70 hover:text-wiz-blue transition-colors"
            >
              GitHub
            </a>
            <span className="wiz-chip px-2.5 py-1 text-xs">
              BETA
            </span>
            <ThemeToggle />
          </div>

          {/* Mobile: toggle + hamburger */}
          <div className="sm:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="text-sky-blue/70 hover:text-wiz-blue transition-colors p-1"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-blue-shadow/60 py-4 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-sky-blue/80 hover:text-wiz-blue hover:bg-blue-shadow/20 rounded-md transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <Search className="w-4 h-4" />
              Browse Actors
            </Link>
            <Link
              to="/sources"
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-sky-blue/80 hover:text-wiz-blue hover:bg-blue-shadow/20 rounded-md transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Data Sources
            </Link>
            <a
              href="https://github.com/threatdex"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-sky-blue/80 hover:text-wiz-blue hover:bg-blue-shadow/20 rounded-md transition-colors"
            >
              GitHub ↗
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
