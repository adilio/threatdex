import type { ThreatActor } from "~/schema"
import { getRarityColor } from "~/schema"

interface CardBackProps {
  actor: ThreatActor
  className?: string
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        marginBottom: "8px",
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

function ListChip({ text }: { text: string }) {
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
        fontSize: "10px",
        padding: "5px 9px",
      }}
    >
      {text}
    </span>
  )
}

function SourceLabel({ source }: { source: string }) {
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
        fontSize: "10px",
        fontWeight: 700,
        padding: "5px 9px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {source}
    </span>
  )
}

export function CardBack({ actor, className }: CardBackProps) {
  const ttps = actor.ttps.slice(0, 4)
  const campaigns = actor.campaigns.slice(0, 2)
  const tools = actor.tools.slice(0, 5)
  const regions = actor.geographies.slice(0, 4)
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
        boxShadow: `0 0 16px ${rarityColor}55, 0 18px 45px -28px ${rarityColor}55`,
      }}
    >
      <div
        style={{
          background: "var(--card-header)",
          borderBottom: `1px solid ${rarityColor}45`,
          padding: "14px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "10px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          Intel Notes
        </p>
        <h3
          style={{
            margin: "6px 0 0",
            fontFamily: "Orbitron, sans-serif",
            fontSize: "22px",
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
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          overflow: "hidden",
          flex: 1,
        }}
      >
        <div
          style={{
            borderRadius: "18px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: "14px",
          }}
        >
          <SectionHeader title="Profile" />
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              lineHeight: 1.6,
              color: "var(--text-muted)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 5,
              overflow: "hidden",
            }}
          >
            {actor.description}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              background: "var(--card-panel)",
              border: "1px solid rgba(2,84,236,0.12)",
              padding: "14px",
            }}
          >
            <SectionHeader title="Tools" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {tools.map((tool) => (
                <ListChip key={tool} text={tool} />
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: "18px",
              background: "var(--card-panel)",
              border: "1px solid rgba(2,84,236,0.12)",
              padding: "14px",
            }}
          >
            <SectionHeader title="Targets" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {regions.map((region) => (
                <ListChip key={region} text={region} />
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: "18px",
            background: "var(--card-panel)",
            border: "1px solid rgba(2,84,236,0.12)",
            padding: "14px",
          }}
        >
          <SectionHeader title="ATT&CK Techniques" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {ttps.map((ttp) => (
              <ListChip key={ttp.techniqueId} text={`${ttp.techniqueId} ${ttp.techniqueName}`} />
            ))}
          </div>
        </div>

        {campaigns.length > 0 && (
          <div
            style={{
              borderRadius: "18px",
              background: "var(--card-panel)",
              border: "1px solid rgba(2,84,236,0.12)",
              padding: "14px",
            }}
          >
            <SectionHeader title="Campaigns" />
            <div style={{ display: "grid", gap: "8px" }}>
              {campaigns.map((campaign) => (
                <div
                  key={campaign.name}
                  style={{
                    borderRadius: "14px",
                    padding: "10px 12px",
                    background: "rgba(2,84,236,0.06)",
                    border: "1px solid rgba(2,84,236,0.1)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontWeight: 700, fontSize: "12px" }}>{campaign.name}</span>
                    {campaign.year && (
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "10px",
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
                      fontSize: "11px",
                      lineHeight: 1.5,
                      color: "var(--text-muted)",
                    }}
                  >
                    {campaign.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(2,84,236,0.12)",
          padding: "12px 16px 16px",
          background: "rgba(2,84,236,0.04)",
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        {sources.map((source) => (
          <SourceLabel key={source} source={source} />
        ))}
      </div>
    </div>
  )
}
