import { z } from "zod"

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const MotivationSchema = z.enum([
  "espionage",
  "financial",
  "sabotage",
  "hacktivism",
  "military",
])

export const SophisticationSchema = z.enum([
  "Low",
  "Medium",
  "High",
  "Very High",
  "Nation-State Elite",
])

export const RaritySchema = z.enum(["MYTHIC", "LEGENDARY", "EPIC", "RARE"])

export const TLPSchema = z.enum(["WHITE", "GREEN"])

export const SourceNameSchema = z.enum([
  "mitre",
  "etda",
  "otx",
  "misp",
  "opencti",
  "manual",
])

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const TTPUsageSchema = z.object({
  techniqueId: z.string().regex(/^T\d{4}(\.\d{3})?$/, {
    message: "techniqueId must match ATT&CK format, e.g. T1566 or T1566.001",
  }),
  techniqueName: z.string().min(1),
  tactic: z.string().min(1),
})

export const CampaignSchema = z.object({
  name: z.string().min(1),
  year: z.string().regex(/^\d{4}$/).optional(),
  description: z.string().min(1),
})

export const SourceAttributionSchema = z.object({
  source: SourceNameSchema,
  sourceId: z.string().optional(),
  fetchedAt: z.string().datetime(),
  url: z.string().url().optional(),
})

// ---------------------------------------------------------------------------
// Main ThreatActor schema
// ---------------------------------------------------------------------------

export const ThreatActorSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  aliases: z.array(z.string()),
  mitreId: z.string().regex(/^G\d{4}$/).optional(),
  country: z.string().optional(),
  countryCode: z.string().length(2).toUpperCase().optional(),
  motivation: z.array(MotivationSchema).min(1),
  threatLevel: z.number().int().min(1).max(10),
  sophistication: SophisticationSchema,
  firstSeen: z.string().regex(/^\d{4}$/).optional(),
  lastSeen: z.string().regex(/^\d{4}$/).optional(),
  sectors: z.array(z.string()),
  geographies: z.array(z.string()),
  tools: z.array(z.string()),
  ttps: z.array(TTPUsageSchema),
  campaigns: z.array(CampaignSchema),
  description: z.string().min(1),
  tagline: z.string().optional(),
  rarity: RaritySchema,
  imageUrl: z.string().url().optional(),
  imagePrompt: z.string().optional(),
  sources: z.array(SourceAttributionSchema),
  tlp: TLPSchema,
  // After migration 003: intel_last_updated replaces last_updated
  // We keep lastUpdated for compatibility with existing code
  lastUpdated: z.string().datetime(),
  // New fields (optional for backward compatibility)
  intelLastUpdated: z.string().datetime().optional(),
  mediaLastUpdated: z.string().datetime().optional(),
  imageCurated: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Paginated response factory
// ---------------------------------------------------------------------------

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })

// ---------------------------------------------------------------------------
// TypeScript types inferred from schemas
// ---------------------------------------------------------------------------

export type Motivation = z.infer<typeof MotivationSchema>
export type Sophistication = z.infer<typeof SophisticationSchema>
export type Rarity = z.infer<typeof RaritySchema>
export type TLP = z.infer<typeof TLPSchema>
export type SourceName = z.infer<typeof SourceNameSchema>
export type TTPUsage = z.infer<typeof TTPUsageSchema>
export type Campaign = z.infer<typeof CampaignSchema>
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>
export type ThreatActor = z.infer<typeof ThreatActorSchema>
export type PaginatedResponse<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Brand color constants
// ---------------------------------------------------------------------------

export const BRAND_COLORS = {
  wizBlue: "#0254EC",
  purplishPink: "#FFBFFF",
  cloudyWhite: "#FFFFFF",
  seriousBlue: "#00123F",
  blueShadow: "#173AAA",
  skyBlue: "#6197FF",
  lightSkyBlue: "#978BFF",
  pinkShadow: "#C64BA4",
  vibrantPink: "#FF0BBE",
  frostingPink: "#FFBFD6",
  surprisingYellow: "#FFFF00",
} as const

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns the primary brand hex color associated with the given rarity tier.
 */
export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case "MYTHIC":
      return BRAND_COLORS.surprisingYellow
    case "LEGENDARY":
      return BRAND_COLORS.vibrantPink
    case "EPIC":
      return BRAND_COLORS.lightSkyBlue
    case "RARE":
      return BRAND_COLORS.skyBlue
  }
}

/**
 * Returns a CSS utility class name for the rarity glow/border effect.
 * Consumers are responsible for defining these classes in their stylesheet.
 */
export function getRarityGlowClass(rarity: Rarity): string {
  switch (rarity) {
    case "MYTHIC":
      return "rarity-glow-mythic"
    case "LEGENDARY":
      return "rarity-glow-legendary"
    case "EPIC":
      return "rarity-glow-epic"
    case "RARE":
      return "rarity-glow-rare"
  }
}

/**
 * Maps a numeric threat level (1–10) to a human-readable severity label.
 */
export function getThreatLevelLabel(
  level: number,
): "Low" | "Medium" | "High" | "Critical" | "Catastrophic" {
  if (level <= 2) return "Low"
  if (level <= 4) return "Medium"
  if (level <= 6) return "High"
  if (level <= 8) return "Critical"
  return "Catastrophic"
}

/**
 * Maps a Sophistication value to a numeric score 1–5 for rendering.
 */
export function getSophisticationScore(soph: Sophistication): number {
  switch (soph) {
    case "Low":
      return 1
    case "Medium":
      return 2
    case "High":
      return 3
    case "Very High":
      return 4
    case "Nation-State Elite":
      return 5
  }
}
