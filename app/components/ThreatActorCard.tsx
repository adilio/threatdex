import { useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"
import type { ThreatActor } from "~/schema"
import { getRarityColor } from "~/schema"
import { CardFront } from "./CardFront"
import { CardBack } from "./CardBack"
import { RarityBadge } from "./RarityBadge"

interface ThreatActorCardProps {
  actor: ThreatActor
  className?: string
}

function getCountryFlag(countryCode?: string) {
  if (!countryCode) return "🌐"
  return String.fromCodePoint(
    ...Array.from(countryCode.toUpperCase()).map(
      (c) => 0x1f1e6 - 65 + c.charCodeAt(0),
    ),
  )
}

/** Strip markdown links and bare URLs for clean display text */
function cleanText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function ModalImagePanel({ actor }: { actor: ThreatActor }) {
  const rarityColor = getRarityColor(actor.rarity)
  const flag = getCountryFlag(actor.countryCode)
  const initials = actor.canonicalName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const gradientMap: Record<string, string> = {
    MYTHIC: "linear-gradient(145deg, rgba(2,84,236,0.92) 0%, rgba(255,255,0,0.7) 100%)",
    LEGENDARY: "linear-gradient(145deg, rgba(23,58,170,0.96) 0%, rgba(255,155,190,0.82) 100%)",
    EPIC: "linear-gradient(145deg, rgba(23,58,170,0.92) 0%, rgba(151,187,255,0.8) 100%)",
    RARE: "linear-gradient(145deg, rgba(2,84,236,0.9) 0%, rgba(97,151,255,0.9) 100%)",
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {actor.imageUrl ? (
        <img
          src={actor.imageUrl}
          alt={actor.canonicalName}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: gradientMap[actor.rarity] ?? gradientMap.RARE,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          {/* Grid lines */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <span style={{ fontSize: "72px", lineHeight: 1, zIndex: 1 }}>{flag}</span>
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "80px",
              fontWeight: 900,
              color: actor.rarity === "MYTHIC" ? "#01123F" : "#ffffff",
              letterSpacing: "0.06em",
              zIndex: 1,
            }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,18,63,0.96) 0%, rgba(0,18,63,0.55) 40%, transparent 70%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "24px 20px",
          gap: "10px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "Orbitron, sans-serif",
            fontSize: "26px",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          {actor.canonicalName}
        </h3>
        {actor.country && (
          <p
            style={{
              margin: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              color: "rgba(255,255,255,0.65)",
            }}
          >
            {flag} {actor.country}
          </p>
        )}
        {actor.tagline && (
          <p
            style={{
              margin: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.5,
            }}
          >
            {actor.tagline}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "4px" }}>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              color: rarityColor,
              background: `${rarityColor}22`,
              border: `1px solid ${rarityColor}44`,
              borderRadius: "999px",
              padding: "4px 10px",
              fontWeight: 700,
            }}
          >
            LVL {actor.threatLevel}
          </span>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              color: "rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "999px",
              padding: "4px 10px",
            }}
          >
            {actor.sophistication}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ThreatActorCard({ actor, className }: ThreatActorCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!modalOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [modalOpen])

  const openModal = useCallback(() => {
    setFlipped(true)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setFlipped(false)
  }, [])

  const subtitle = actor.tagline
    ? actor.tagline
    : cleanText(actor.description).slice(0, 90) || null

  return (
    <>
      <div className={`flex w-[340px] max-w-full flex-col gap-3 ${className ?? ""}`.trim()}>
        {/* Flip card — click opens modal */}
        <div
          className="card-shell card-flip-container"
          onClick={openModal}
          role="button"
          tabIndex={0}
          aria-label={`Open dossier for ${actor.canonicalName}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              openModal()
            }
          }}
          style={{
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
            outline: "none",
          }}
        >
          <div className={`card-flip-inner${flipped ? " is-flipped" : ""}`}>
            <div className="card-flip-front">
              <CardFront actor={actor} />
            </div>
            {/* Back face is blank — modal takes over */}
            <div className="card-flip-back">
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "1.35rem",
                  background: "var(--card-bg)",
                  border: `2px solid ${getRarityColor(actor.rarity)}`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Below-card info */}
        <div className="flex items-center gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold uppercase tracking-[0.05em] text-app-text">
              {actor.canonicalName}
            </p>
            {subtitle && (
              <p className="truncate text-sm text-app-muted">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen dossier modal */}
      {modalOpen && (
        <div
          className="dex-modal-overlay"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="dex-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${actor.canonicalName} dossier`}
          >
            {/* Toolbar */}
            <div className="dex-modal-toolbar">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="dex-kicker">Threat Actor Dossier</p>
                  <h3 className="font-display text-2xl font-black uppercase tracking-[0.08em] text-app-text truncate">
                    {actor.canonicalName}
                  </h3>
                </div>
                <RarityBadge rarity={actor.rarity} size="md" />
              </div>
              <button
                type="button"
                className="dex-icon-button shrink-0"
                onClick={closeModal}
                aria-label="Close dossier"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body: image left, intel right */}
            <div className="dex-modal-body">
              <div className="dex-modal-image-col">
                <ModalImagePanel actor={actor} />
              </div>
              <div className="dex-modal-intel-col">
                <CardBack actor={actor} variant="panel" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
