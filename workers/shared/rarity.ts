/**
 * Rarity classification logic for ThreatDex actors.
 *
 * Provides:
 * - computeThreatLevel() — derive 1–10 score from available signals
 * - computeRarity()      — derive card rarity tier from level + sophistication
 */

type Sophistication = string

const SOPHISTICATION_SCORES: Record<string, number> = {
  "Nation-State Elite": 5,
  "Very High": 4,
  High: 3,
  Medium: 2,
  Low: 1,
}

/**
 * Derive a 1–10 threat level score from available intelligence signals.
 *
 * Scoring formula:
 * - Base score from sophistication tier (1–5)
 * - +1 for every 5 distinct TTPs observed (capped at +3)
 * - +1 for every 2 confirmed campaigns (capped at +2)
 * - Final result is clamped to [1, 10]
 */
export function computeThreatLevel(params: {
  sophistication: Sophistication
  ttpsCount: number
  campaignsCount: number
}): number {
  const { sophistication, ttpsCount, campaignsCount } = params
  const base = SOPHISTICATION_SCORES[sophistication] ?? 1

  const ttpBonus = Math.min(3, Math.floor(ttpsCount / 5))
  const campaignBonus = Math.min(2, Math.floor(campaignsCount / 2))

  const score = base + ttpBonus + campaignBonus
  return Math.max(1, Math.min(10, score))
}

/**
 * Return the rarity tier for an actor card.
 *
 * Rules (evaluated in order — first match wins):
 * - MYTHIC:    threatLevel >= 9  AND sophistication == "Nation-State Elite"
 * - LEGENDARY: threatLevel >= 7  AND sophistication in {"Nation-State Elite", "Very High"}
 * - EPIC:      threatLevel >= 5  AND sophistication in {"Very High", "High"}
 * - RARE:      everything else
 *
 * A small bonus is applied when the actor is corroborated by multiple
 * independent sources (sourcesCount >= 3 bumps the effective level by 1).
 */
export function computeRarity(params: {
  threatLevel: number
  sophistication: Sophistication
  sourcesCount: number
}): "MYTHIC" | "LEGENDARY" | "EPIC" | "RARE" {
  const { threatLevel, sophistication, sourcesCount } = params

  let effectiveLevel = threatLevel
  if (sourcesCount >= 3) {
    effectiveLevel = Math.min(10, effectiveLevel + 1)
  }

  if (effectiveLevel >= 9 && sophistication === "Nation-State Elite") {
    return "MYTHIC"
  }

  if (
    effectiveLevel >= 7 &&
    (sophistication === "Nation-State Elite" || sophistication === "Very High")
  ) {
    return "LEGENDARY"
  }

  if (
    effectiveLevel >= 5 &&
    (sophistication === "Very High" || sophistication === "High")
  ) {
    return "EPIC"
  }

  return "RARE"
}
