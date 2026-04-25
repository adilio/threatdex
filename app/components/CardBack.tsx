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
        width: expanded ? "min(920px, 90vw)" : "280px",
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
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sources footer                                                      */}
      {/* ------------------------------------------------------------------ */}
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
        {expanded
          ? actor.sources.map((src, idx) => (
              <a
                key={`${src.source}-${src.sourceId ?? idx}`}
                href={src.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  color: "#97BBFF",
                  fontFamily: "monospace",
                  fontSize: "10px",
                  textDecoration: src.url ? "underline" : "none",
                }}
              >
                {src.source.toUpperCase()}
                {src.sourceId ? `:${src.sourceId}` : ""}
              </a>
            ))
          : uniqueSources.map((src) => (
              <SourceLabel key={src} source={src} />
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
