import type React from "react"
import type { ThreatActor, Rarity } from "~/schema"
import { getRarityColor, getSophisticationScore } from "~/schema"
import { RarityBadge } from "./RarityBadge"
import { ThreatLevelBar } from "./ThreatLevelBar"

interface CardFrontProps {
  actor: ThreatActor
  className?: string
  variant?: "compact" | "expanded"
}

function getRarityBorderStyle(rarity: Rarity): React.CSSProperties {
  const rarityColor = getRarityColor(rarity)

  return {
    border: `2px solid ${rarityColor}`,
    boxShadow: `0 0 18px ${rarityColor}66, 0 28px 60px -36px ${rarityColor}77`,
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
  variant,
}: {
  actor: ThreatActor
  rarity: Rarity
  variant: "compact" | "expanded"
}) {
  const initials = actor.canonicalName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  const gradientMap: Record<Rarity, string> = {
    MYTHIC:
      "linear-gradient(135deg, rgba(2,84,236,0.92) 0%, rgba(255,255,0,0.86) 100%)",
    LEGENDARY:
      "linear-gradient(135deg, rgba(23,58,170,0.96) 0%, rgba(255,155,190,0.92) 100%)",
    EPIC:
      "linear-gradient(135deg, rgba(23,58,170,0.92) 0%, rgba(151,187,255,0.9) 100%)",
    RARE:
      "linear-gradient(135deg, rgba(2,84,236,0.9) 0%, rgba(97,151,255,0.96) 100%)",
  }

  const fontSize = variant === "expanded" ? "92px" : "52px"
  const flagSize = variant === "expanded" ? "78px" : "46px"

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
        gap: "12px",
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
          backgroundSize: variant === "expanded" ? "32px 32px" : "26px 26px",
          opacity: 0.78,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "auto 0 12% 0",
          height: variant === "expanded" ? "120px" : "72px",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.34) 18%, rgba(255,255,255,0.1) 52%, transparent 100%)",
          filter: "blur(16px)",
        }}
      />
      <span style={{ fontSize: flagSize, lineHeight: 1, zIndex: 1 }}>
        {getCountryFlag(actor.countryCode)}
      </span>
      <span
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize,
          fontWeight: 900,
          color: rarity === "MYTHIC" ? "#01123F" : "#FFFFFF",
          letterSpacing: "0.08em",
          textShadow: "0 8px 28px rgba(1,18,63,0.22)",
          zIndex: 1,
        }}
      >
        {initials}
      </span>
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: variant === "expanded" ? "12px" : "10px",
          color: "rgba(255,255,255,0.82)",
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

function MotivationChip({
  motivation,
  compact = false,
}: {
  motivation: string
  compact?: boolean
}) {
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
        fontSize: compact ? "10px" : "11px",
        fontWeight: 700,
        padding: compact ? "4px 9px" : "6px 12px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}
    >
      {motivation}
    </span>
  )
}

function InfoPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        borderRadius: "16px",
        border: "1px solid rgba(2,84,236,0.12)",
        background: "var(--card-panel)",
        padding: "12px 14px",
      }}
    >
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
        {label}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: "16px",
          lineHeight: 1.25,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SophisticationPips({
  score,
  max = 5,
  size = "compact",
}: {
  score: number
  max?: number
  size?: "compact" | "expanded"
}) {
  const dotSize = size === "expanded" ? "10px" : "8px"

  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      {Array.from({ length: max }, (_, index) => (
        <div
          key={index}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: "999px",
            backgroundColor: index < score ? "#6197FF" : "rgba(23,58,170,0.2)",
            boxShadow: index < score ? "0 0 8px rgba(97,151,255,0.55)" : undefined,
          }}
        />
      ))}
    </div>
  )
}

function AssetStatusBadge({
  actor,
  compact,
}: {
  actor: ThreatActor
  compact: boolean
}) {
  const hasGenerated = Boolean(actor.imageUrl)

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        border: "1px solid rgba(2,84,236,0.14)",
        background: hasGenerated
          ? "rgba(2,84,236,0.12)"
          : "rgba(255,191,255,0.18)",
        color: "var(--text-primary)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: compact ? "9px" : "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: compact ? "4px 8px" : "6px 10px",
      }}
    >
      {hasGenerated ? "Generated Art" : "Dex Portrait"}
    </span>
  )
}

export function CardFront({
  actor,
  className,
  variant = "compact",
}: CardFrontProps) {
  const rarityBorder = getRarityBorderStyle(actor.rarity)
  const sophScore = getSophisticationScore(actor.sophistication)
  const aliases = actor.aliases.slice(0, variant === "expanded" ? 4 : 2)
  const motivations = actor.motivation.slice(0, variant === "expanded" ? 4 : 2)
  const activeWindow =
    actor.firstSeen && actor.lastSeen
      ? `${actor.firstSeen} - ${actor.lastSeen}`
      : actor.firstSeen
        ? `Since ${actor.firstSeen}`
        : actor.lastSeen
          ? `Until ${actor.lastSeen}`
          : "Unknown"

  const compact = variant === "compact"

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
          padding: compact ? "12px 16px" : "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${getRarityColor(actor.rarity)}45`,
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: compact ? "8px" : "10px" }}>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: compact ? "11px" : "12px",
              color: "var(--text-muted)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {actor.mitreId ?? actor.id.toUpperCase()}
          </span>
          <AssetStatusBadge actor={actor} compact={compact} />
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: compact ? "10px" : "11px",
              background:
                actor.tlp === "GREEN"
                  ? "rgba(0,200,83,0.16)"
                  : "rgba(2,84,236,0.1)",
              color: actor.tlp === "GREEN" ? "#007a3d" : "var(--text-primary)",
              border: `1px solid ${
                actor.tlp === "GREEN"
                  ? "rgba(0,122,61,0.2)"
                  : "rgba(2,84,236,0.14)"
              }`,
              borderRadius: "999px",
              padding: compact ? "4px 8px" : "6px 10px",
              letterSpacing: "0.08em",
            }}
          >
            TLP:{actor.tlp}
          </span>
          <RarityBadge rarity={actor.rarity} size={compact ? "sm" : "md"} />
        </div>
      </div>

      <div
        style={{
          height: compact ? "42%" : "40%",
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid rgba(2,84,236,0.08)",
        }}
      >
        {actor.imageUrl ? (
          <img
            src={actor.imageUrl}
            alt={actor.canonicalName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <HeroPlaceholder actor={actor} rarity={actor.rarity} variant={variant} />
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
          padding: compact ? "18px 16px 16px" : "24px 22px 22px",
          display: "flex",
          flexDirection: "column",
          gap: compact ? "14px" : "18px",
          flex: 1,
          overflowY: compact ? "hidden" : "auto",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: compact ? "12px" : "18px",
            }}
          >
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: compact ? "24px" : "36px",
                  lineHeight: 1.02,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                {actor.canonicalName}
              </h3>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: compact ? "13px" : "16px",
                  lineHeight: 1.6,
                  color: "var(--text-muted)",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  display: compact ? "-webkit-box" : "block",
                  WebkitBoxOrient: compact ? "vertical" : undefined,
                  WebkitLineClamp: compact ? 2 : undefined,
                  overflow: compact ? "hidden" : "visible",
                }}
              >
                {actor.tagline ?? actor.description}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                placeItems: "center",
                minWidth: compact ? "68px" : "92px",
                aspectRatio: "1 / 1",
                borderRadius: compact ? "18px" : "24px",
                background:
                  "linear-gradient(180deg, rgba(2,84,236,0.1) 0%, rgba(255,191,255,0.22) 100%)",
                border: "1px solid rgba(2,84,236,0.14)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24)",
              }}
            >
              <span
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: compact ? "28px" : "40px",
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
                margin: compact ? "10px 0 0" : "14px 0 0",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: compact ? "11px" : "12px",
                color: "var(--text-muted)",
                letterSpacing: "0.03em",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              aka {aliases.join(" - ")}
              {actor.aliases.length > aliases.length
                ? ` +${actor.aliases.length - aliases.length}`
                : ""}
            </p>
          )}
        </div>

        <div
          style={{
            borderRadius: compact ? "18px" : "24px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: compact ? "14px" : "18px",
            display: "grid",
            gap: compact ? "12px" : "16px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: compact ? "10px" : "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: "8px",
              }}
            >
              Threat Level
            </div>
            <ThreatLevelBar level={actor.threatLevel} showLabel={!compact} />
          </div>

          {compact ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <InfoPill
                label="Origin"
                value={`${actor.country ?? "Unknown"} ${getCountryFlag(actor.countryCode)}`}
              />
              <InfoPill label="Active" value={activeWindow} />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
              <InfoPill
                label="Origin"
                value={`${actor.country ?? "Unknown"} ${getCountryFlag(actor.countryCode)}`}
              />
              <InfoPill label="Active" value={activeWindow} />
              <InfoPill
                label="Sources"
                value={`${actor.sources.length} feed${actor.sources.length === 1 ? "" : "s"}`}
              />
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              borderTop: compact ? "none" : "1px solid rgba(2,84,236,0.08)",
              paddingTop: compact ? 0 : "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: compact ? "10px" : "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  marginBottom: "6px",
                }}
              >
                Sophistication
              </div>
              <SophisticationPips
                score={sophScore}
                size={compact ? "compact" : "expanded"}
              />
            </div>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: compact ? "11px" : "13px",
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              {actor.sophistication}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: compact ? "8px" : "10px",
          }}
        >
          {motivations.map((motivation) => (
            <MotivationChip
              key={motivation}
              motivation={motivation}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
