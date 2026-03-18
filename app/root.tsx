import type { LinksFunction } from "react-router"
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"
import appCss from "./app.css?url"
import { Navigation } from "~/components/Navigation"

const themeInitScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem("threatdex-theme")
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      document.documentElement.dataset.theme = storedTheme || systemTheme
    } catch {
      document.documentElement.dataset.theme = "dark"
    }
  })();
`

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@500;700;800;900&family=Space+Grotesk:wght@400;500;700&display=swap",
  },
]

export function meta() {
  return [
    { title: "ThreatDex — Know your adversaries, card by card" },
    {
      name: "description",
      content:
        "Aggregated cyber threat intelligence rendered as interactive trading cards.",
    },
  ]
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="app-shell">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <>
      <Navigation />
      <Outlet />
    </>
  )
}
