import { Fragment } from "react"
import type { ReactNode } from "react"
import type { ThreatActor } from "~/schema"
import { getRarityColor } from "~/schema"

interface CardBackProps {
  actor: ThreatActor
  className?: string
  variant?: "compact" | "expanded"
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

function ListChip({
  text,
  compact = false,
}: {
  text: string
  compact?: boolean
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        border: "1px solid rgba(2,84,236,0.14)",
        background: "rgba(2,84,236,0.08)",
        color: "var(--text-primary)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: compact ? "10px" : "11px",
        padding: compact ? "5px 9px" : "7px 11px",
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
  const compact = variant === "compact"
  const ttps = compact ? actor.ttps.slice(0, 4) : actor.ttps
  const campaigns = compact ? actor.campaigns.slice(0, 2) : actor.campaigns
  const tools = compact ? actor.tools.slice(0, 6) : actor.tools
  const regions = compact ? actor.geographies.slice(0, 6) : actor.geographies
  const sources = Array.from(new Set(actor.sources.map((source) => source.source)))
  const rarityColor = getRarityColor(actor.rarity)

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
          <div>
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
        <div
          style={{
            borderRadius: compact ? "18px" : "24px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: compact ? "14px" : "18px",
          }}
        >
          <SectionHeader title="Profile" />
          <p
            style={{
              margin: 0,
              fontSize: compact ? "12px" : "15px",
              lineHeight: 1.7,
              color: "var(--text-muted)",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {renderRichText(actor.description)}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr 1fr" : "1fr 1fr",
            gap: compact ? "12px" : "16px",
          }}
        >
          <div
            style={{
              borderRadius: compact ? "18px" : "24px",
              background: "var(--card-panel)",
              border: "1px solid rgba(2,84,236,0.12)",
              padding: compact ? "14px" : "18px",
            }}
          >
            <SectionHeader title="Tools" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {tools.length > 0 ? (
                tools.map((tool) => (
                  <ListChip key={tool} text={tool} compact={compact} />
                ))
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: compact ? "11px" : "13px" }}>
                  No tools listed
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              borderRadius: compact ? "18px" : "24px",
              background: "var(--card-panel)",
              border: "1px solid rgba(2,84,236,0.12)",
              padding: compact ? "14px" : "18px",
            }}
          >
            <SectionHeader title="Targets" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {regions.length > 0 ? (
                regions.map((region) => (
                  <ListChip key={region} text={region} compact={compact} />
                ))
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: compact ? "11px" : "13px" }}>
                  No regions listed
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: compact ? "18px" : "24px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: compact ? "14px" : "18px",
          }}
        >
          <SectionHeader title="ATT&CK Techniques" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ttps.length > 0 ? (
              ttps.map((ttp) => (
                <ListChip
                  key={`${ttp.techniqueId}-${ttp.techniqueName}`}
                  text={`${ttp.techniqueId} ${ttp.techniqueName}`}
                  compact={compact}
                />
              ))
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: compact ? "11px" : "13px" }}>
                No ATT&CK techniques listed
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            borderRadius: compact ? "18px" : "24px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: compact ? "14px" : "18px",
          }}
        >
          <SectionHeader title="Campaigns" />
          <div style={{ display: "grid", gap: compact ? "8px" : "12px" }}>
            {campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <div
                  key={campaign.name}
                  style={{
                    borderRadius: compact ? "14px" : "18px",
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
                          fontSize: compact ? "10px" : "11px",
                          color: "var(--text-muted)",
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
                    {renderRichText(campaign.description)}
                  </p>
                </div>
              ))
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: compact ? "11px" : "13px" }}>
                No campaigns listed
              </span>
            )}
          </div>
        </div>
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
