import React from "react"
import type { Rarity } from "@threatdex/schema"

interface RarityBadgeProps {
  rarity: Rarity
  size?: "sm" | "md" | "lg"
}

const RARITY_STYLES: Record<
  Rarity,
  { background: string; color: string; border: string; boxShadow?: string }
> = {
  MYTHIC: {
    background: "#FFFF00",
    color: "#00123F",
    border: "1px solid #FFFF00",
    boxShadow: "0 0 8px #FFFF00, 0 0 16px rgba(255,255,0,0.4)",
  },
  LEGENDARY: {
    background: "#FF0BBE",
    color: "#FFFFFF",
    border: "1px solid #FF0BBE",
    boxShadow: "0 0 6px rgba(255,11,190,0.5)",
  },
  EPIC: {
    background: "#978BFF",
    color: "#00123F",
    border: "1px solid #978BFF",
  },
  RARE: {
    background: "#6197FF",
    color: "#00123F",
    border: "1px solid #6197FF",
  },
}

const SIZE_STYLES = {
  sm: { fontSize: "9px", padding: "1px 5px", letterSpacing: "0.08em" },
  md: { fontSize: "11px", padding: "2px 8px", letterSpacing: "0.1em" },
  lg: { fontSize: "13px", padding: "3px 10px", letterSpacing: "0.12em" },
}

export function RarityBadge({ rarity, size = "md" }: RarityBadgeProps) {
  const rarityStyle = RARITY_STYLES[rarity]
  const sizeStyle = SIZE_STYLES[size]

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "monospace",
        fontWeight: 700,
        textTransform: "uppercase",
        borderRadius: "3px",
        whiteSpace: "nowrap",
        ...rarityStyle,
        ...sizeStyle,
      }}
    >
      {rarity}
    </span>
  )
}
