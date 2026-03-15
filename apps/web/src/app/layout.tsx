import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThreatDex — Know your adversaries, card by card",
  description:
    "ThreatDex aggregates cyber threat actor intelligence from public CTI feeds and renders each actor as an interactive trading card. Know your adversaries, card by card.",
  keywords: [
    "threat intelligence",
    "CTI",
    "cyber threats",
    "APT",
    "threat actors",
    "MITRE ATT&CK",
  ],
  openGraph: {
    title: "ThreatDex — Know your adversaries, card by card",
    description:
      "Interactive threat actor intelligence cards powered by MITRE ATT&CK, ETDA, and more.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-serious-blue text-cloudy-white font-sans antialiased">
        <Navigation />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t border-blue-shadow/40 mt-16 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-wiz-blue">Threat</span>
                <span className="text-lg font-bold text-vibrant-pink">Dex</span>
              </div>
              <p className="text-sm text-sky-blue/60 font-mono">
                Know your adversaries, card by card.
              </p>
              <p className="text-xs text-sky-blue/40">
                Data sourced from MITRE ATT&amp;CK, ETDA, AlienVault OTX
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
