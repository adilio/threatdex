import type React from "react"
import type { ThreatActor, Rarity } from "~/schema"
import { getRarityColor, getSophisticationScore } from "~/schema"
import { RarityBadge } from "./RarityBadge"
import { ThreatLevelBar } from "./ThreatLevelBar"

interface CardFrontProps {
  actor: ThreatActor
  className?: string
}

function getRarityBorderStyle(rarity: Rarity): React.CSSProperties {
  const rarityColor = getRarityColor(rarity)

  return {
    border: `2px solid ${rarityColor}`,
    boxShadow: `0 0 16px ${rarityColor}66, 0 18px 45px -28px ${rarityColor}66`,
  }
}

function getCountryFlag(countryCode?: string) {
  if (!countryCode) return "🌐"

  return String.fromCodePoint(
    ...Array.from(countryCode.toUpperCase()).map(
      (character) => 0x1f1e6 - 65 + character.charCodeAt(0),
    ),
  )
}

function HeroPlaceholder({
  actor,
  rarity,
}: {
  actor: ThreatActor
  rarity: Rarity
}) {
  const initials = actor.canonicalName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  const gradientMap: Record<Rarity, string> = {
    MYTHIC:
      "linear-gradient(135deg, rgba(2,84,236,0.92) 0%, rgba(255,255,0,0.85) 100%)",
    LEGENDARY:
      "linear-gradient(135deg, rgba(23,58,170,0.94) 0%, rgba(255,155,190,0.9) 100%)",
    EPIC:
      "linear-gradient(135deg, rgba(23,58,170,0.92) 0%, rgba(151,187,255,0.9) 100%)",
    RARE:
      "linear-gradient(135deg, rgba(2,84,236,0.86) 0%, rgba(97,151,255,0.92) 100%)",
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: gradientMap[rarity],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, var(--card-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--card-grid-line) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          opacity: 0.75,
        }}
      />
      <span style={{ fontSize: "46px", lineHeight: 1, zIndex: 1 }}>
        {getCountryFlag(actor.countryCode)}
      </span>
      <span
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: "52px",
          fontWeight: 900,
          color: rarity === "MYTHIC" ? "#01123F" : "#FFFFFF",
          letterSpacing: "0.08em",
          textShadow: "0 6px 24px rgba(1,18,63,0.22)",
          zIndex: 1,
        }}
      >
        {initials}
      </span>
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px",
          color: "rgba(255,255,255,0.8)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          zIndex: 1,
        }}
      >
        {actor.id}
      </span>
    </div>
  )
}

const MOTIVATION_COLORS: Record<string, { bg: string; text: string }> = {
  espionage: { bg: "rgba(2,84,236,0.16)", text: "#0254EC" },
  financial: { bg: "rgba(255,255,0,0.18)", text: "#665700" },
  sabotage: { bg: "rgba(255,155,190,0.2)", text: "#A10B6E" },
  hacktivism: { bg: "rgba(151,187,255,0.24)", text: "#173AAA" },
  military: { bg: "rgba(197,107,164,0.18)", text: "#8C2B6A" },
}

function MotivationChip({ motivation }: { motivation: string }) {
  const style = MOTIVATION_COLORS[motivation] ?? {
    bg: "rgba(2,84,236,0.14)",
    text: "#0254EC",
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.text}30`,
        borderRadius: "999px",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "10px",
        fontWeight: 700,
        padding: "4px 9px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}
    >
      {motivation}
    </span>
  )
}

function SophisticationPips({
  score,
  max = 5,
}: {
  score: number
  max?: number
}) {
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      {Array.from({ length: max }, (_, index) => (
        <div
          key={index}
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: index < score ? "#6197FF" : "rgba(23,58,170,0.2)",
            boxShadow: index < score ? "0 0 6px rgba(97,151,255,0.45)" : undefined,
          }}
        />
      ))}
    </div>
  )
}

export function CardFront({ actor, className }: CardFrontProps) {
  const rarityBorder = getRarityBorderStyle(actor.rarity)
  const sophScore = getSophisticationScore(actor.sophistication)
  const aliases = actor.aliases.slice(0, 2)
  const motivations = actor.motivation.slice(0, 2)
  const activeWindow =
    actor.firstSeen && actor.lastSeen
      ? `${actor.firstSeen} - ${actor.lastSeen}`
      : actor.firstSeen
        ? `Since ${actor.firstSeen}`
        : actor.lastSeen
          ? `Until ${actor.lastSeen}`
          : "Unknown"

  return (
    <div
      className={`card-face ${className ?? ""}`.trim()}
      style={{
        background: "var(--card-bg)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        ...rarityBorder,
      }}
    >
      <div
        style={{
          background: "var(--card-header)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${getRarityColor(actor.rarity)}45`,
          gap: "12px",
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-muted)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {actor.mitreId ?? actor.id.toUpperCase()}
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "10px",
              background: actor.tlp === "GREEN" ? "rgba(0,200,83,0.16)" : "rgba(2,84,236,0.1)",
              color: actor.tlp === "GREEN" ? "#007a3d" : "var(--text-primary)",
              border: `1px solid ${actor.tlp === "GREEN" ? "rgba(0,122,61,0.2)" : "rgba(2,84,236,0.14)"}`,
              borderRadius: "999px",
              padding: "4px 8px",
              letterSpacing: "0.08em",
            }}
          >
            TLP:{actor.tlp}
          </span>
          <RarityBadge rarity={actor.rarity} size="sm" />
        </div>
      </div>

      <div style={{ height: "42%", minHeight: 0, position: "relative", overflow: "hidden" }}>
        {actor.imageUrl ? (
          <img
            src={actor.imageUrl}
            alt={actor.canonicalName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <HeroPlaceholder actor={actor} rarity={actor.rarity} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--card-hero-overlay)",
          }}
        />
      </div>

      <div
        style={{
          padding: "18px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          flex: 1,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "24px",
                  lineHeight: 1.05,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                {actor.canonicalName}
              </h3>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text-muted)",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {actor.tagline ?? actor.description}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                placeItems: "center",
                minWidth: "64px",
                aspectRatio: "1 / 1",
                borderRadius: "18px",
                background: "var(--surface-chip)",
                border: "1px solid rgba(2,84,236,0.14)",
              }}
            >
              <span
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "26px",
                  fontWeight: 900,
                  color: getRarityColor(actor.rarity),
                  letterSpacing: "0.08em",
                }}
              >
                {actor.canonicalName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          {aliases.length > 0 && (
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                color: "var(--text-muted)",
                letterSpacing: "0.03em",
              }}
            >
              aka {aliases.join(" - ")}
              {actor.aliases.length > aliases.length ? ` +${actor.aliases.length - aliases.length}` : ""}
            </p>
          )}
        </div>

        <div
          style={{
            borderRadius: "18px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: "14px",
            display: "grid",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "10px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: "6px",
              }}
            >
              Threat Level
            </div>
            <ThreatLevelBar level={actor.threatLevel} />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  marginBottom: "6px",
                }}
              >
                Origin
              </div>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>
                {actor.country ?? "Unknown"} {getCountryFlag(actor.countryCode)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  marginBottom: "6px",
                }}
              >
                Active
              </div>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>{activeWindow}</div>
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "10px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: "6px",
              }}
            >
              Sophistication
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <SophisticationPips score={sophScore} />
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                {actor.sophistication}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {motivations.map((motivation) => (
            <MotivationChip key={motivation} motivation={motivation} />
          ))}
        </div>
      </div>
    </div>
  )
}
