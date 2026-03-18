import { getThreatLevelLabel } from "~/schema"

interface ThreatLevelBarProps {
  level: number
  showLabel?: boolean
}

function getSegmentColor(segmentIndex: number, totalFilled: number): string {
  if (segmentIndex >= totalFilled) return "rgba(23,58,170,0.2)"
  const ratio = segmentIndex / 9
  if (ratio < 0.4) return "#00C853" // green
  if (ratio < 0.65) return "#FFD600" // yellow
  if (ratio < 0.8) return "#FF6D00" // orange
  return "#FF1744" // red
}

export function ThreatLevelBar({ level, showLabel = false }: ThreatLevelBarProps) {
  const clamped = Math.max(1, Math.min(10, Math.round(level)))

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      }}
    >
      <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              width: "10px",
              height: "14px",
              borderRadius: "2px",
              backgroundColor: getSegmentColor(i, clamped),
              transition: "background-color 0.2s ease",
              boxShadow:
                i < clamped
                  ? `0 0 4px ${getSegmentColor(i, clamped)}80`
                  : undefined,
            }}
          />
        ))}
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "var(--text-primary)",
            fontWeight: 700,
            marginLeft: "4px",
          }}
        >
          {clamped}/10
        </span>
      </div>
      {showLabel && (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {getThreatLevelLabel(clamped)}
        </span>
      )}
    </div>
  )
}
