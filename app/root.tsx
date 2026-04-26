import type { LinksFunction } from "react-router"
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"
import appCss from "./app.css?url"
import { Navigation } from "~/components/Navigation"

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Rubik:wght@400;500&display=swap",
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

// Runs synchronously before first paint — prevents flash of wrong theme.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('threatdex-theme')||'dark';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})()`

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {/* Theme script runs before CSS is applied — must be first in <head> after meta */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Links />
      </head>
      <body style={{ minHeight: "100vh", margin: 0 }}>
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
