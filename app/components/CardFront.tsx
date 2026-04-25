import React from "react"
import type { ThreatActor, Rarity } from "~/schema"
import { getRarityColor, getSophisticationScore } from "~/schema"
import { BadgeCheck } from "lucide-react"
import { RarityBadge } from "./RarityBadge"
import { ThreatLevelBar } from "./ThreatLevelBar"

interface CardFrontProps {
  actor: ThreatActor
  className?: string
}

// ---------------------------------------------------------------------------
// Helper: Count verified sources for actor badge
// ---------------------------------------------------------------------------

function getVerifiedSourceCount(actor: ThreatActor): number {
  const sources = actor.sources ?? []
  // Count unique source types (mitre, etda, otx, manual, etc.)
  const uniqueSources = new Set(sources.map((s) => s.source))
  return uniqueSources.size
}

// ---------------------------------------------------------------------------
// Rarity-specific border/glow styles
// ---------------------------------------------------------------------------

function getRarityBorderStyle(rarity: Rarity): React.CSSProperties {
  switch (rarity) {
    case "MYTHIC":
      return {
        border: "2px solid #FFFF00",
        boxShadow:
          "0 0 12px #FFFF00, 0 0 30px rgba(255,255,0,0.25), inset 0 0 20px rgba(255,255,0,0.04)",
      }
    case "LEGENDARY":
      return {
        border: "2px solid #FF9BBE",
        boxShadow:
          "0 0 10px rgba(255,155,190,0.7), 0 0 24px rgba(255,155,190,0.25), inset 0 0 16px rgba(255,155,190,0.04)",
      }
    case "EPIC":
      return {
        border: "2px solid #97BBFF",
        boxShadow: "0 0 8px rgba(151,187,255,0.5), 0 0 20px rgba(151,187,255,0.2)",
      }
    case "RARE":
    default:
      return {
        border: "2px solid #6197FF",
        boxShadow: "0 0 6px rgba(97,151,255,0.4)",
      }
  }
}

// ---------------------------------------------------------------------------
// Hero image placeholder — gradient + initials
// ---------------------------------------------------------------------------

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
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const gradientMap: Record<Rarity, string> = {
    MYTHIC:
      "linear-gradient(135deg, #01123F 0%, #173AAA 40%, #FFFF00 100%)",
    LEGENDARY:
      "linear-gradient(135deg, #01123F 0%, #C56BA4 50%, #FF9BBE 100%)",
    EPIC: "linear-gradient(135deg, #01123F 0%, #173AAA 55%, #97BBFF 100%)",
    RARE: "linear-gradient(135deg, #01123F 0%, #173AAA 60%, #6197FF 100%)",
  }

  const countryFlag =
    actor.countryCode
      ? String.fromCodePoint(
          ...Array.from(actor.countryCode.toUpperCase()).map(
            (c) => 0x1f1e6 - 65 + c.charCodeAt(0),
          ),
        )
      : "🌐"

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
        gap: "8px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative circuit-like lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 28px,
              rgba(97,151,255,0.07) 28px,
              rgba(97,151,255,0.07) 29px
            ),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 28px,
              rgba(97,151,255,0.07) 28px,
              rgba(97,151,255,0.07) 29px
            )
          `,
        }}
      />
      <span style={{ fontSize: "36px", lineHeight: 1 }}>{countryFlag}</span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "32px",
          fontWeight: 900,
          color: getRarityColor(rarity),
          letterSpacing: "0.12em",
          textShadow: `0 0 12px ${getRarityColor(rarity)}`,
          zIndex: 1,
        }}
      >
        {initials}
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          zIndex: 1,
        }}
      >
        {actor.id}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Motivation chip
// ---------------------------------------------------------------------------

const MOTIVATION_COLORS: Record<string, { bg: string; text: string }> = {
  espionage: { bg: "rgba(2,84,236,0.25)", text: "#6197FF" },
  financial: { bg: "rgba(255,255,0,0.15)", text: "#FFFF00" },
  sabotage: { bg: "rgba(255,155,190,0.15)", text: "#FF9BBE" },
  hacktivism: { bg: "rgba(151,187,255,0.2)", text: "#97BBFF" },
  military: { bg: "rgba(197,107,164,0.2)", text: "#FFBFD6" },
}

function MotivationChip({ motivation }: { motivation: string }) {
  const style = MOTIVATION_COLORS[motivation] ?? {
    bg: "rgba(97,151,255,0.15)",
    text: "#6197FF",
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.text}40`,
        borderRadius: "3px",
        fontFamily: "monospace",
        fontSize: "9px",
        fontWeight: 700,
        padding: "2px 6px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}
    >
      {motivation}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sophistication pip row
// ---------------------------------------------------------------------------

function SophisticationPips({
  score,
  max = 5,
}: {
  score: number
  max?: number
}) {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: i < score ? "#97BBFF" : "#173AAA",
            boxShadow: i < score ? "0 0 4px #97BBFF80" : undefined,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardFront
// ---------------------------------------------------------------------------

export function CardFront({ actor, className }: CardFrontProps) {
  const rarityBorder = getRarityBorderStyle(actor.rarity)
  const sophScore = getSophisticationScore(actor.sophistication)

  const displayAliases = actor.aliases.slice(0, 3)
  const displayMotivations = actor.motivation.slice(0, 4)

  const firstLastSeen =
    actor.firstSeen && actor.lastSeen
      ? `${actor.firstSeen} – ${actor.lastSeen}`
      : actor.firstSeen
        ? `Since ${actor.firstSeen}`
        : actor.lastSeen
          ? `Until ${actor.lastSeen}`
          : null

  // Calculate intel staleness (days since last intel update)
  const intelLastUpdated = actor.intelLastUpdated || actor.lastUpdated
  const intelStaleDays = intelLastUpdated
    ? Math.floor((Date.now() - new Date(intelLastUpdated).getTime()) / (24 * 60 * 60 * 1000))
    : null

  return (
    <div
      className={className}
      style={{
        // Phase 4.9: Fluid mobile sizing with aspect ratio
        width: "100%",
        maxWidth: "320px",
        aspectRatio: "280 / 392",
        borderRadius: "12px",
        background: "linear-gradient(160deg, #01123F 0%, #0a1a4a 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "sans-serif",
        position: "relative",
        ...rarityBorder,
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          background: "linear-gradient(90deg, #01123F 0%, #173AAA 100%)",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${getRarityColor(actor.rarity)}40`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#6197FF",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {actor.mitreId ?? actor.id.toUpperCase()}
        </span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {/* Phase 4.1: Verified actor badge */}
          {getVerifiedSourceCount(actor) >= 2 && (
            <span
              title={`Verified across ${getVerifiedSourceCount(actor)} sources`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                fontFamily: "monospace",
                fontSize: "9px",
                fontWeight: 700,
                background: "rgba(0,200,83,0.2)",
                color: "#00C853",
                border: "1px solid rgba(0,200,83,0.5)",
                borderRadius: "3px",
                padding: "1px 4px",
                letterSpacing: "0.05em",
              }}
            >
              <BadgeCheck style={{ width: "10px", height: "10px" }} />
              Verified
            </span>
          )}
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "9px",
              background: actor.tlp === "GREEN" ? "rgba(0,200,83,0.2)" : "rgba(255,255,255,0.1)",
              color: actor.tlp === "GREEN" ? "#00C853" : "#FFFFFF",
              border: `1px solid ${actor.tlp === "GREEN" ? "#00C85380" : "#FFFFFF40"}`,
              borderRadius: "3px",
              padding: "1px 5px",
              letterSpacing: "0.08em",
            }}
          >
            TLP:{actor.tlp}
          </span>
          {intelStaleDays !== null && intelStaleDays > 30 && (
            <span
              title={`Intel data last updated ${intelStaleDays} days ago`}
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                background: "rgba(255,170,0,0.2)",
                color: "#FFAA00",
                border: "1px solid rgba(255,170,0,0.5)",
                borderRadius: "3px",
                padding: "1px 4px",
                letterSpacing: "0.05em",
              }}
            >
              Intel {intelStaleDays}d old
            </span>
          )}
          <RarityBadge rarity={actor.rarity} size="sm" />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Hero image                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          height: "140px",
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {actor.imageUrl ? (
          <img
            src={actor.imageUrl}
            alt={actor.canonicalName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <HeroPlaceholder actor={actor} rarity={actor.rarity} />
        )}
        {/* Gradient fade at bottom to blend into card body */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40px",
            background: "linear-gradient(to top, #01123F, transparent)",
          }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Name section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          padding: "6px 10px 4px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "sans-serif",
            fontWeight: 800,
            fontSize: "16px",
            color: "#FFFFFF",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {actor.canonicalName}
        </div>
        {actor.tagline && (
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: "10px",
              color: "#97BBFF",
              fontStyle: "italic",
              marginTop: "1px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {actor.tagline}
          </div>
        )}
        {displayAliases.length > 0 && (
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "9px",
              color: "#6197FF",
              marginTop: "3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            aka {displayAliases.join(" · ")}
            {actor.aliases.length > 3 && (
              <span style={{ color: "#97BBFF" }}>
                {" "}+{actor.aliases.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          margin: "4px 10px",
          background: "rgba(23,58,170,0.3)",
          borderRadius: "6px",
          border: "1px solid rgba(97,151,255,0.15)",
          padding: "6px 8px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          {/* Threat level */}
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                color: "#6197FF",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "3px",
              }}
            >
              Threat Level
            </div>
            <ThreatLevelBar level={actor.threatLevel} />
          </div>

          {/* Sophistication */}
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                color: "#6197FF",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "3px",
              }}
            >
              Sophistication
            </div>
            <SophisticationPips score={sophScore} />
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                color: "#FFBFFF",
                marginTop: "2px",
              }}
            >
              {actor.sophistication}
            </div>
          </div>

          {/* Country */}
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                color: "#6197FF",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "2px",
              }}
            >
              Origin
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#FFFFFF",
              }}
            >
              {actor.country ?? "Unknown"}
              {actor.countryCode && (
                <span style={{ marginLeft: "4px" }}>
                  {String.fromCodePoint(
                    ...Array.from(actor.countryCode.toUpperCase()).map(
                      (c) => 0x1f1e6 - 65 + c.charCodeAt(0),
                    ),
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Active period */}
          {firstLastSeen && (
            <div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "8px",
                  color: "#6197FF",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "2px",
                }}
              >
                Active
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  color: "#FFFFFF",
                }}
              >
                {firstLastSeen}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer — motivation tags                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          padding: "4px 10px 8px",
          marginTop: "auto",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#6197FF",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginRight: "2px",
          }}
        >
          Motivation:
        </span>
        {displayMotivations.map((m) => (
          <MotivationChip key={m} motivation={m} />
        ))}
      </div>

      {/* Rarity-colored bottom accent line */}
      <div
        style={{
          height: "3px",
          background: `linear-gradient(90deg, transparent, ${getRarityColor(actor.rarity)}, transparent)`,
          flexShrink: 0,
        }}
      />
    </div>
  )
}
