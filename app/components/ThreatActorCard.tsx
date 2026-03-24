import { useEffect, useState } from "react"
import { Maximize2, X } from "lucide-react"
import type { ThreatActor } from "~/schema"
import { getRarityColor } from "~/schema"
import { CardFront } from "./CardFront"
import { CardBack } from "./CardBack"
import { RarityBadge } from "./RarityBadge"
import { ThreatLevelBar } from "./ThreatLevelBar"

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

function CardImageBack({ actor }: { actor: ThreatActor }) {
  const rarityColor = getRarityColor(actor.rarity)
  const flag = getCountryFlag(actor.countryCode)
  const activeWindow =
    actor.firstSeen && actor.lastSeen
      ? `${actor.firstSeen}–${actor.lastSeen}`
      : actor.firstSeen
        ? `Active since ${actor.firstSeen}`
        : actor.lastSeen
          ? `Until ${actor.lastSeen}`
          : null

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "1.35rem",
        overflow: "hidden",
        position: "relative",
        border: `2px solid ${rarityColor}`,
        boxShadow: `0 0 28px ${rarityColor}66`,
        background: "#00123F",
      }}
    >
      {/* Hero image or gradient placeholder */}
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
            background: `linear-gradient(145deg, #00123F 0%, ${rarityColor}55 60%, ${rarityColor}22 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "96px", lineHeight: 1 }}>{flag}</span>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,18,63,0.98) 0%, rgba(0,18,63,0.82) 38%, rgba(0,18,63,0.2) 62%, transparent 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "20px 18px",
          gap: "10px",
        }}
      >
        {/* Rarity + flip hint row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <RarityBadge rarity={actor.rarity} size="sm" />
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "10px",
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.08em",
            }}
          >
            click to flip ↩
          </span>
        </div>

        {/* Name */}
        <h3
          style={{
            margin: 0,
            fontFamily: "Orbitron, sans-serif",
            fontSize: "22px",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          {actor.canonicalName}
        </h3>

        {/* Stats row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {actor.country && (
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "12px",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {flag} {actor.country}
            </span>
          )}
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              color: rarityColor,
              background: `${rarityColor}22`,
              border: `1px solid ${rarityColor}44`,
              borderRadius: "999px",
              padding: "3px 9px",
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
              padding: "3px 9px",
            }}
          >
            {actor.sophistication}
          </span>
        </div>

        {/* Threat level bar */}
        <div>
          <ThreatLevelBar level={actor.threatLevel} showLabel={false} />
        </div>

        {/* Active window */}
        {activeWindow && (
          <p
            style={{
              margin: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "10px",
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.06em",
            }}
          >
            {activeWindow}
          </p>
        )}

        {/* Motivation tags */}
        {actor.motivation.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {actor.motivation.slice(0, 3).map((m) => (
              <span
                key={m}
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px",
                  color: "rgba(255,191,255,0.85)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                #{m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Top-right TLP badge */}
      <div style={{ position: "absolute", top: "12px", right: "12px" }}>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "10px",
            background:
              actor.tlp === "GREEN" ? "rgba(0,200,83,0.18)" : "rgba(2,84,236,0.18)",
            color: actor.tlp === "GREEN" ? "#00c853" : "#6197FF",
            border: `1px solid ${actor.tlp === "GREEN" ? "rgba(0,200,83,0.28)" : "rgba(97,151,255,0.28)"}`,
            borderRadius: "999px",
            padding: "4px 9px",
            letterSpacing: "0.08em",
          }}
        >
          TLP:{actor.tlp}
        </span>
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
      if (event.key === "Escape") {
        setModalOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [modalOpen])

  const subtitle = actor.tagline
    ? actor.tagline
    : cleanText(actor.description).slice(0, 90) || null

  return (
    <>
      <div className={`flex w-[340px] max-w-full flex-col gap-3 ${className ?? ""}`.trim()}>
        {/* Flip card */}
        <div
          className="card-shell card-flip-container"
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          aria-label={`${actor.canonicalName} — click to ${flipped ? "see card front" : "view image"}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setFlipped((f) => !f)
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
            <div className="card-flip-back">
              <CardImageBack actor={actor} />
            </div>
          </div>
        </div>

        {/* Below-card info */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold uppercase tracking-[0.05em] text-app-text">
              {actor.canonicalName}
            </p>
            {subtitle && (
              <p className="truncate text-sm text-app-muted">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="dex-icon-button shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setModalOpen(true)
            }}
            aria-label={`Open intel dossier for ${actor.canonicalName}`}
            title="Open Intel Dossier"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="dex-modal-overlay"
          onClick={() => setModalOpen(false)}
          role="presentation"
        >
          <div
            className="dex-modal-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${actor.canonicalName} dossier`}
          >
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
                onClick={() => setModalOpen(false)}
                aria-label="Close dossier"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dex-modal-body">
              <div className="dex-modal-card-col">
                <div className="card-shell" style={{ cursor: "default", pointerEvents: "none" }}>
                  <CardFront actor={actor} />
                </div>
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
