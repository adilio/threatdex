import React from "react"
import type { ThreatActor } from "~/schema"
import { getRarityColor } from "~/schema"

interface CardBackProps {
  actor: ThreatActor
  className?: string
  expanded?: boolean
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        borderBottom: "1px solid rgba(97,151,255,0.2)",
        paddingBottom: "3px",
        marginBottom: "5px",
      }}
    >
      <span style={{ fontSize: "10px" }}>{icon}</span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#6197FF",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 700,
        }}
      >
        {title}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TTP chip
// ---------------------------------------------------------------------------

function TTPChip({
  techniqueId,
  tactic,
}: {
  techniqueId: string
  tactic: string
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        background: "rgba(2,84,236,0.2)",
        border: "1px solid rgba(97,151,255,0.3)",
        borderRadius: "4px",
        padding: "2px 5px",
        gap: "1px",
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#FFBFFF",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        {techniqueId}
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "7px",
          color: "#6197FF",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {tactic}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool chip
// ---------------------------------------------------------------------------

function ToolChip({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "rgba(151,139,255,0.15)",
        border: "1px solid rgba(151,139,255,0.3)",
        borderRadius: "3px",
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#97BBFF",
        padding: "2px 5px",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Source label
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  mitre: { bg: "rgba(255,0,0,0.15)", text: "#FF6B6B" },
  etda: { bg: "rgba(97,151,255,0.15)", text: "#6197FF" },
  otx: { bg: "rgba(255,165,0,0.15)", text: "#FFA500" },
  misp: { bg: "rgba(255,155,190,0.15)", text: "#FF9BBE" },
  opencti: { bg: "rgba(2,84,236,0.2)", text: "#0254EC" },
  manual: { bg: "rgba(255,191,255,0.1)", text: "#FFBFFF" },
}

function SourceLabel({ source }: { source: string }) {
  const style = SOURCE_COLORS[source] ?? { bg: "rgba(97,151,255,0.1)", text: "#6197FF" }
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
        fontSize: "8px",
        fontWeight: 700,
        padding: "2px 5px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {source}
    </span>
  )
}

function getCountryFlag(countryCode?: string) {
  if (!countryCode) return "🌐"
  return String.fromCodePoint(
    ...Array.from(countryCode.toUpperCase()).map(
      (c) => 0x1f1e6 - 65 + c.charCodeAt(0),
    ),
  )
}

function ActorImagePanel({ actor }: { actor: ThreatActor }) {
  const rarityColor = getRarityColor(actor.rarity)
  const initials = actor.canonicalName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  return (
    <aside
      style={{
        borderRadius: "12px",
        border: `1px solid ${rarityColor}55`,
        background: "rgba(1,18,63,0.72)",
        boxShadow: `0 0 22px ${rarityColor}22`,
        overflow: "hidden",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "min(64vh, 560px)",
          minHeight: "420px",
          background: `linear-gradient(145deg, #01123F 0%, ${rarityColor}44 100%)`,
        }}
      >
        {actor.imageUrl ? (
          <img
            src={actor.imageUrl}
            alt={actor.canonicalName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "18px",
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          >
            <span style={{ fontSize: "58px", lineHeight: 1 }}>
              {getCountryFlag(actor.countryCode)}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "60px",
                fontWeight: 900,
                color: rarityColor,
                letterSpacing: "0.08em",
                textShadow: `0 0 16px ${rarityColor}`,
              }}
            >
              {initials}
            </span>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(1,18,63,0.95) 0%, rgba(1,18,63,0.5) 42%, transparent 72%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "18px",
            gap: "8px",
          }}
        >
          <span
            style={{
              alignSelf: "flex-start",
              color: rarityColor,
              border: `1px solid ${rarityColor}66`,
              background: `${rarityColor}22`,
              borderRadius: "999px",
              padding: "4px 10px",
              fontFamily: "monospace",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.1em",
            }}
          >
            {actor.rarity}
          </span>
          <div
            style={{
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: "22px",
              lineHeight: 1.08,
            }}
          >
            {actor.canonicalName}
          </div>
          {actor.country && (
            <div
              style={{
                color: "rgba(255,255,255,0.68)",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            >
              {getCountryFlag(actor.countryCode)} {actor.country}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: "rgba(97,151,255,0.18)",
        }}
      >
        <div style={{ background: "#01123F", padding: "12px" }}>
          <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase" }}>
            Threat
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 900, color: rarityColor }}>
            {actor.threatLevel}/10
          </div>
        </div>
        <div style={{ background: "#01123F", padding: "12px" }}>
          <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase" }}>
            Sophistication
          </div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#FFFFFF" }}>
            {actor.sophistication}
          </div>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// CardBack
// ---------------------------------------------------------------------------

export function CardBack({ actor, className, expanded = false }: CardBackProps) {
  const displayTTPs = expanded ? actor.ttps : actor.ttps.slice(0, 5)
  const displayCampaigns = expanded ? actor.campaigns : actor.campaigns.slice(0, 3)
  const displayTools = expanded ? actor.tools : actor.tools.slice(0, 8)
  const displaySectors = expanded ? actor.sectors : actor.sectors.slice(0, 3)
  const displayGeos = expanded ? actor.geographies : actor.geographies.slice(0, 3)
  const uniqueSources = Array.from(new Set(actor.sources.map((s) => s.source)))
  const ttpsByTactic = displayTTPs.reduce<Record<string, typeof displayTTPs>>((acc, ttp) => {
    const tactic = ttp.tactic || "Unknown"
    acc[tactic] = acc[tactic] ?? []
    acc[tactic].push(ttp)
    return acc
  }, {})

  return (
    <div
      className={className}
      style={{
        width: expanded ? "min(1120px, 90vw)" : "280px",
        height: expanded ? "min(820px, 90vh)" : "392px",
        borderRadius: "12px",
        background: "linear-gradient(160deg, #01123F 0%, #0a1a4a 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "sans-serif",
        position: "relative",
        border: `2px solid ${getRarityColor(actor.rarity)}60`,
        boxShadow: `0 0 12px ${getRarityColor(actor.rarity)}30`,
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          background: "linear-gradient(90deg, #01123F 0%, #173AAA 100%)",
          padding: "6px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          borderBottom: `1px solid ${getRarityColor(actor.rarity)}40`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#6197FF",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          Threat Intelligence
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontWeight: 800,
            fontSize: "13px",
            color: "#FFFFFF",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {actor.canonicalName}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable content                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          flex: 1,
          padding: expanded ? "18px 20px" : "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: expanded ? "16px" : "8px",
          overflow: expanded ? "auto" : "hidden",
        }}
      >
        {expanded ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
              alignItems: "start",
            }}
          >
            <ActorImagePanel actor={actor} />
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
              <section>
                <SectionHeader title="Background" icon="▣" />
                <div
                  style={{
                    background: "rgba(23,58,170,0.18)",
                    border: "1px solid rgba(97,151,255,0.2)",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  {actor.tagline && (
                    <p
                      style={{
                        margin: "0 0 10px",
                        color: "#97BBFF",
                        fontSize: "14px",
                        fontStyle: "italic",
                        lineHeight: 1.45,
                      }}
                    >
                      &quot;{actor.tagline}&quot;
                    </p>
                  )}
                  <p
                    style={{
                      margin: 0,
                      color: "rgba(255,255,255,0.78)",
                      fontSize: "14px",
                      lineHeight: 1.65,
                    }}
                  >
                    {actor.description}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "8px",
                      marginTop: "14px",
                    }}
                  >
                    {actor.motivation.length > 0 && (
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>
                          Motivation
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {actor.motivation.map((motivation) => (
                            <ToolChip key={motivation} name={motivation} />
                          ))}
                        </div>
                      </div>
                    )}
                    {actor.aliases.length > 0 && (
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>
                          Also Known As
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", lineHeight: 1.5 }}>
                          {actor.aliases.slice(0, 8).join(", ")}
                          {actor.aliases.length > 8 ? `, +${actor.aliases.length - 8} more` : ""}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {displayCampaigns.length > 0 && (
                <section>
                  <SectionHeader title="Known Operations" icon="▦" />
                  <div style={{ display: "grid", gap: "8px" }}>
                    {displayCampaigns.map((campaign) => (
                      <div
                        key={campaign.name}
                        style={{
                          background: "rgba(23,58,170,0.2)",
                          border: "1px solid rgba(97,151,255,0.15)",
                          borderRadius: "8px",
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
                          <span style={{ color: "#FFFFFF", fontWeight: 800, fontSize: "14px" }}>
                            {campaign.name}
                          </span>
                          {campaign.year && (
                            <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#97BBFF", flexShrink: 0 }}>
                              {campaign.year}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.64)", fontSize: "12px", lineHeight: 1.55 }}>
                          {campaign.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionHeader title="Tools, Malware & Targets" icon="◆" />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "7px" }}>
                      Tools & Malware
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {displayTools.length > 0
                        ? displayTools.map((tool) => <ToolChip key={tool} name={tool} />)
                        : <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px" }}>None listed</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "7px" }}>
                      Target Sectors
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {displaySectors.length > 0
                        ? displaySectors.map((sector) => <ToolChip key={sector} name={sector} />)
                        : <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px" }}>None listed</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6197FF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "7px" }}>
                      Target Regions
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {displayGeos.length > 0
                        ? displayGeos.map((geo) => <ToolChip key={geo} name={geo} />)
                        : <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px" }}>None listed</span>}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title="Sources" icon="↗" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {actor.sources.length > 0
                    ? actor.sources.map((src, idx) => (
                        <a
                          key={`${src.source}-${src.sourceId ?? idx}`}
                          href={src.url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            color: "#97BBFF",
                            border: "1px solid rgba(151,187,255,0.28)",
                            background: "rgba(151,187,255,0.1)",
                            borderRadius: "999px",
                            padding: "5px 9px",
                            fontFamily: "monospace",
                            fontSize: "10px",
                            fontWeight: 800,
                            textDecoration: "none",
                          }}
                        >
                          {src.source.toUpperCase()}
                          {src.sourceId ? `:${src.sourceId}` : ""}
                        </a>
                      ))
                    : <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px" }}>No sources listed</span>}
                </div>
              </section>

              {displayTTPs.length > 0 && (
                <section>
                  <SectionHeader title="Tactics & Techniques" icon="⚔" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                    {Object.entries(ttpsByTactic).map(([tactic, entries]) => (
                      <div
                        key={tactic}
                        style={{
                          background: "rgba(23,58,170,0.18)",
                          border: "1px solid rgba(97,151,255,0.18)",
                          borderRadius: "8px",
                          padding: "10px",
                        }}
                      >
                        <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#97BBFF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                          {tactic}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {entries.map((ttp, idx) => (
                            <div key={ttp.techniqueId || `ttp-${idx}`} style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#FFBFFF", fontWeight: 700, minWidth: "70px" }}>
                                {ttp.techniqueId || "N/A"}
                              </span>
                              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.72)", lineHeight: 1.35 }}>
                                {ttp.techniqueName || "Unknown technique"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : (
          <>
        {/* TTPs */}
        {displayTTPs.length > 0 && (
          <div>
            <SectionHeader title="Techniques & Tactics" icon="⚔" />
            {expanded ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {Object.entries(ttpsByTactic).map(([tactic, entries]) => (
                  <div
                    key={tactic}
                    style={{
                      background: "rgba(23,58,170,0.18)",
                      border: "1px solid rgba(97,151,255,0.18)",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#97BBFF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                      {tactic}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {entries.map((ttp, idx) => (
                        <div key={ttp.techniqueId || `ttp-${idx}`} style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#FFBFFF", fontWeight: 700, minWidth: "70px" }}>
                            {ttp.techniqueId || "N/A"}
                          </span>
                          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.72)", lineHeight: 1.35 }}>
                            {ttp.techniqueName || "Unknown technique"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {displayTTPs.map((ttp, idx) => (
                  <TTPChip
                    key={ttp.techniqueId || `ttp-${idx}`}
                    techniqueId={ttp.techniqueId || "N/A"}
                    tactic={ttp.tactic || "Unknown"}
                  />
                ))}
                {actor.ttps.length > 5 && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "8px",
                      color: "#6197FF",
                      alignSelf: "center",
                    }}
                  >
                    +{actor.ttps.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Campaigns */}
        {displayCampaigns.length > 0 && (
          <div>
            <SectionHeader title="Known Campaigns" icon="📋" />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {displayCampaigns.map((campaign) => (
                <div
                  key={campaign.name}
                  style={{
                    background: "rgba(23,58,170,0.2)",
                    border: "1px solid rgba(97,151,255,0.15)",
                    borderRadius: "4px",
                    padding: "4px 6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "6px",
                      marginBottom: "1px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "9px",
                        color: "#FFBFFF",
                        fontWeight: 700,
                      }}
                    >
                      {campaign.name}
                    </span>
                    {campaign.year && (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "8px",
                          color: "#6197FF",
                        }}
                      >
                        {campaign.year}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "sans-serif",
                      fontSize: "8px",
                      color: "rgba(255,255,255,0.55)",
                      lineHeight: 1.4,
                      overflow: expanded ? undefined : "hidden",
                      display: expanded ? undefined : "-webkit-box",
                      WebkitLineClamp: expanded ? undefined : 2,
                      WebkitBoxOrient: expanded ? undefined : "vertical",
                    }}
                  >
                    {campaign.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tools */}
        {displayTools.length > 0 && (
          <div>
            <SectionHeader title="Tools & Malware" icon="🔧" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {displayTools.map((tool) => (
                <ToolChip key={tool} name={tool} />
              ))}
              {actor.tools.length > 8 && (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "8px",
                    color: "#6197FF",
                    alignSelf: "center",
                  }}
                >
                  +{actor.tools.length - 8}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats grid: sectors + geographies */}
        {(displaySectors.length > 0 || displayGeos.length > 0) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
            }}
          >
            {displaySectors.length > 0 && (
              <div>
                <SectionHeader title="Sectors" icon="🏭" />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {displaySectors.map((sector) => (
                    <span
                      key={sector}
                      style={{
                        fontFamily: "monospace",
                        fontSize: "8px",
                        color: "#FFBFFF",
                      }}
                    >
                      • {sector}
                    </span>
                  ))}
                  {actor.sectors.length > 3 && (
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "8px",
                        color: "#6197FF",
                      }}
                    >
                      +{actor.sectors.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {displayGeos.length > 0 && (
              <div>
                <SectionHeader title="Targets" icon="🌍" />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {displayGeos.map((geo) => (
                    <span
                      key={geo}
                      style={{
                        fontFamily: "monospace",
                        fontSize: "8px",
                        color: "#FFBFFF",
                      }}
                    >
                      • {geo}
                    </span>
                  ))}
                  {actor.geographies.length > 3 && (
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "8px",
                        color: "#6197FF",
                      }}
                    >
                      +{actor.geographies.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sources footer                                                      */}
      {/* ------------------------------------------------------------------ */}
      {!expanded && (
        <div
          style={{
            borderTop: "1px solid rgba(97,151,255,0.2)",
            padding: "5px 10px 7px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
            background: "rgba(0,18,63,0.6)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "7px",
              color: "#6197FF",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginRight: "2px",
            }}
          >
            Sources:
          </span>
          {uniqueSources.map((src) => (
            <SourceLabel key={src} source={src} />
          ))}
        </div>
      )}

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
