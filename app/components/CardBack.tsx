import { Fragment } from "react"
import type { ReactNode } from "react"
import type { ThreatActor } from "~/schema"
import { getRarityColor } from "~/schema"

interface CardBackProps {
  actor: ThreatActor
  className?: string
  variant?: "compact" | "expanded" | "panel"
}

function stripCitations(text: string): string {
  return text
    .replace(/\s*\(Citation:[^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function renderRichText(text: string) {
  const tokenRegex =
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(tokenRegex)) {
    const index = match.index ?? 0

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    if (match[1] && match[2]) {
      nodes.push(
        <a
          key={`${match[1]}-${index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#0254EC",
            fontWeight: 700,
            textDecoration: "underline",
            textUnderlineOffset: "0.16em",
          }}
        >
          {match[1]}
        </a>,
      )
    } else if (match[3] || match[4]) {
      nodes.push(
        <strong key={`strong-${index}`}>{match[3] ?? match[4]}</strong>,
      )
    } else if (match[5] || match[6]) {
      nodes.push(<em key={`em-${index}`}>{match[5] ?? match[6]}</em>)
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>)
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        marginBottom: "10px",
      }}
    >
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          fontWeight: 700,
        }}
      >
        {title}
      </span>
      <div style={{ flex: 1, height: "1px", background: "rgba(2,84,236,0.12)" }} />
    </div>
  )
}

function Chip({
  text,
  compact = false,
  variant = "default",
}: {
  text: string
  compact?: boolean
  variant?: "default" | "tool" | "ttp" | "target"
}) {
  const styles = {
    default: { bg: "rgba(2,84,236,0.08)", border: "rgba(2,84,236,0.14)", color: "var(--text-primary)" },
    tool:    { bg: "rgba(151,139,255,0.12)", border: "rgba(151,139,255,0.28)", color: "#978BFF" },
    ttp:     { bg: "rgba(2,84,236,0.07)", border: "rgba(2,84,236,0.16)", color: "var(--text-primary)" },
    target:  { bg: "rgba(97,151,255,0.10)", border: "rgba(97,151,255,0.22)", color: "#6197FF" },
  }[variant]

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "6px",
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: compact ? "10px" : "11px",
        fontWeight: variant === "tool" ? 600 : 400,
        padding: compact ? "4px 8px" : "6px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  )
}

function SourceLabel({
  source,
  compact = false,
}: {
  source: string
  compact?: boolean
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        border: "1px solid rgba(2,84,236,0.14)",
        background: "rgba(255,191,255,0.18)",
        color: "var(--text-primary)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: compact ? "10px" : "11px",
        fontWeight: 700,
        padding: compact ? "5px 9px" : "7px 11px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {source}
    </span>
  )
}

export function CardBack({
  actor,
  className,
  variant = "compact",
}: CardBackProps) {
  const isPanel = variant === "panel"
  const compact = variant === "compact"
  const allTtps = compact ? actor.ttps.slice(0, 8) : actor.ttps
  const ttpsByTactic = allTtps.reduce<Record<string, typeof actor.ttps>>((acc, ttp) => {
    const tactic = ttp.tactic || "Other"
    ;(acc[tactic] ??= []).push(ttp)
    return acc
  }, {})
  const sortedCampaigns = [...actor.campaigns].sort((a, b) => {
    if (!a.year && !b.year) return 0
    if (!a.year) return 1
    if (!b.year) return -1
    return b.year.localeCompare(a.year)
  })
  const campaigns = compact ? sortedCampaigns.slice(0, 2) : sortedCampaigns
  const tools = compact ? actor.tools.slice(0, 8) : actor.tools
  const regions = compact ? actor.geographies.slice(0, 6) : actor.geographies
  const sectors = compact ? actor.sectors.slice(0, 6) : actor.sectors
  const aliases = compact ? actor.aliases.slice(0, 6) : actor.aliases
  const sources = Array.from(new Set(actor.sources.map((source) => source.source)))
  const rarityColor = getRarityColor(actor.rarity)

  const borderRadius = compact ? "18px" : "24px"
  const sectionPad = compact ? "14px" : "18px"
  const fontSize = { body: compact ? "12px" : "15px", chip: compact ? "10px" : "11px", label: compact ? "11px" : "13px" }

  const contentSections = (
    <>
      {/* Aliases — shown at top in panel mode; card mode has aliases in the header */}
      {isPanel && aliases.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {aliases.map((alias) => (
            <span
              key={alias}
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "6px",
                border: "1px solid rgba(97,151,255,0.22)",
                background: "rgba(97,151,255,0.10)",
                color: "#6197FF",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                padding: "4px 9px",
                whiteSpace: "nowrap",
              }}
            >
              {alias}
            </span>
          ))}
          {actor.aliases.length > aliases.length && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "6px",
                border: "1px solid rgba(97,151,255,0.14)",
                background: "rgba(97,151,255,0.06)",
                color: "var(--text-muted)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 9px",
              }}
            >
              +{actor.aliases.length - aliases.length}
            </span>
          )}
        </div>
      )}

      {/* Profile */}
      <div
        style={{
          borderRadius,
          background: "var(--card-panel)",
          border: "1px solid rgba(2,84,236,0.12)",
          padding: sectionPad,
        }}
      >
        <SectionHeader title="Profile" />
        <p
          style={{
            margin: 0,
            fontSize: fontSize.body,
            lineHeight: 1.7,
            color: "var(--text-muted)",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {renderRichText(stripCitations(actor.description))}
        </p>
      </div>

      {/* Tools & Targets */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: compact ? "12px" : "16px",
        }}
      >
        <div
          style={{
            borderRadius,
            background: "var(--card-panel)",
            border: "1px solid rgba(151,139,255,0.18)",
            padding: sectionPad,
          }}
        >
          <SectionHeader title="Tools" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {tools.length > 0 ? (
              tools.map((tool) => (
                <Chip key={tool} text={tool} compact={compact} variant="tool" />
              ))
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: fontSize.label }}>
                None listed
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            borderRadius,
            background: "var(--card-panel)",
            border: "1px solid rgba(97,151,255,0.18)",
            padding: sectionPad,
          }}
        >
          <SectionHeader title="Targets" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {regions.length === 0 && sectors.length === 0 ? (
              <span style={{ color: "var(--text-muted)", fontSize: fontSize.label }}>
                None listed
              </span>
            ) : (
              <>
                {regions.map((r) => (
                  <Chip key={r} text={r} compact={compact} variant="target" />
                ))}
                {sectors.map((s) => (
                  <Chip key={s} text={s} compact={compact} variant="default" />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ATT&CK Techniques grouped by tactic */}
      <div
        style={{
          borderRadius,
          background: "var(--card-panel)",
          border: "1px solid rgba(2,84,236,0.12)",
          padding: sectionPad,
        }}
      >
        <SectionHeader title="ATT&CK Techniques" />
        {allTtps.length > 0 ? (
          <div style={{ display: "grid", gap: compact ? "10px" : "14px" }}>
            {Object.entries(ttpsByTactic).map(([tactic, ttps]) => (
              <div key={tactic}>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "9px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  {tactic}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {ttps.map((ttp) => (
                    <Chip
                      key={`${ttp.techniqueId}-${ttp.techniqueName}`}
                      text={`${ttp.techniqueId} · ${ttp.techniqueName}`}
                      compact={compact}
                      variant="ttp"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: fontSize.label }}>
            No ATT&CK techniques listed
          </span>
        )}
      </div>

      {/* Campaigns */}
      <div
        style={{
          borderRadius,
          background: "var(--card-panel)",
          border: "1px solid rgba(2,84,236,0.12)",
          padding: sectionPad,
        }}
      >
        <SectionHeader title="Campaigns" />
        <div style={{ display: "grid", gap: compact ? "8px" : "12px" }}>
          {campaigns.length > 0 ? (
            campaigns.map((campaign) => (
              <div
                key={campaign.name}
                style={{
                  borderRadius: compact ? "10px" : "14px",
                  padding: compact ? "10px 12px" : "14px 16px",
                  background: "rgba(2,84,236,0.06)",
                  border: "1px solid rgba(2,84,236,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: compact ? "12px" : "15px" }}>
                    {campaign.name}
                  </span>
                  {campaign.year && (
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: fontSize.chip,
                        color: "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {campaign.year}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: compact ? "11px" : "14px",
                    lineHeight: 1.6,
                    color: "var(--text-muted)",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {renderRichText(stripCitations(campaign.description))}
                </p>
              </div>
            ))
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: fontSize.label }}>
              No campaigns listed
            </span>
          )}
        </div>
      </div>
    </>
  )

  const sourceFooter = (
    <div
      style={{
        borderTop: "1px solid rgba(2,84,236,0.12)",
        paddingTop: "14px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {sources.map((source) => (
        <SourceLabel key={source} source={source} compact={compact} />
      ))}
    </div>
  )

  if (isPanel) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {contentSections}
        {sourceFooter}
      </div>
    )
  }

  return (
    <div
      className={`card-face ${className ?? ""}`.trim()}
      style={{
        background: "var(--card-bg)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: `2px solid ${rarityColor}`,
        boxShadow: `0 0 18px ${rarityColor}55, 0 28px 60px -36px ${rarityColor}55`,
      }}
    >
      <div
        style={{
          background: "var(--card-header)",
          borderBottom: `1px solid ${rarityColor}45`,
          padding: compact ? "14px 16px" : "18px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: compact ? "10px" : "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
              }}
            >
              Intel Notes
            </p>
            <h3
              style={{
                margin: "8px 0 0",
                fontFamily: "Orbitron, sans-serif",
                fontSize: compact ? "22px" : "34px",
                lineHeight: 1.05,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {actor.canonicalName}
            </h3>
            {aliases.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" }}>
                {aliases.map((alias) => (
                  <span
                    key={alias}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: "6px",
                      border: "1px solid rgba(97,151,255,0.22)",
                      background: "rgba(97,151,255,0.10)",
                      color: "#6197FF",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: compact ? "9px" : "10px",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      padding: compact ? "3px 7px" : "4px 9px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {alias}
                  </span>
                ))}
                {actor.aliases.length > aliases.length && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: "6px",
                      border: "1px solid rgba(97,151,255,0.14)",
                      background: "rgba(97,151,255,0.06)",
                      color: "var(--text-muted)",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: compact ? "9px" : "10px",
                      fontWeight: 600,
                      padding: compact ? "3px 7px" : "4px 9px",
                    }}
                  >
                    +{actor.aliases.length - aliases.length}
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            style={{
              borderRadius: compact ? "16px" : "22px",
              border: "1px solid rgba(2,84,236,0.14)",
              background: "rgba(2,84,236,0.08)",
              padding: compact ? "8px 10px" : "12px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: compact ? "10px" : "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: "4px",
              }}
            >
              Last Updated
            </div>
            <div style={{ fontWeight: 800, fontSize: compact ? "12px" : "14px" }}>
              {new Date(actor.lastUpdated).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: compact ? "16px" : "22px",
          display: "flex",
          flexDirection: "column",
          gap: compact ? "14px" : "18px",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {contentSections}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(2,84,236,0.12)",
          padding: compact ? "12px 16px 16px" : "16px 22px 20px",
          background: "rgba(2,84,236,0.04)",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {sources.map((source) => (
          <SourceLabel key={source} source={source} compact={compact} />
        ))}
      </div>
    </div>
  )
}
