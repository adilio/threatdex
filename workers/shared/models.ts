/**
 * Shared TypeScript interfaces matching the ThreatActor canonical schema.
 * All ingestion workers produce ThreatActorData instances that are then
 * persisted via shared/supabase.ts.
 */

export interface TTPUsage {
  techniqueId: string
  techniqueName: string
  tactic: string
}

export interface Campaign {
  name: string
  year?: string
  description: string
}

export interface SourceAttribution {
  source: "mitre" | "etda" | "otx" | "misp" | "opencti" | "manual"
  sourceId?: string
  fetchedAt: string
  url?: string
}

export interface ThreatActorData {
  id: string
  canonicalName: string
  aliases: string[]
  mitreId?: string
  country?: string
  countryCode?: string
  motivation: string[]
  threatLevel: number
  sophistication: string
  firstSeen?: string
  lastSeen?: string
  sectors: string[]
  geographies: string[]
  tools: string[]
  ttps: TTPUsage[]
  campaigns: Campaign[]
  description: string
  tagline?: string
  rarity: "MYTHIC" | "LEGENDARY" | "EPIC" | "RARE"
  imageUrl?: string
  imagePrompt?: string
  sources: SourceAttribution[]
  tlp: "WHITE" | "GREEN"
  lastUpdated: string
}

/**
 * Convert camelCase actor data to snake_case for Supabase.
 *
 * Note: After migration 003, we write to intel_last_updated instead of last_updated.
 * The last_updated column is now a computed field in the actors_with_freshness view.
 */
export function toDbRecord(actor: ThreatActorData): Record<string, unknown> {
  return {
    id: actor.id,
    canonical_name: actor.canonicalName,
    aliases: actor.aliases,
    mitre_id: actor.mitreId ?? null,
    country: actor.country ?? null,
    country_code: actor.countryCode ?? null,
    motivation: actor.motivation,
    threat_level: actor.threatLevel,
    sophistication: actor.sophistication,
    first_seen: actor.firstSeen ?? null,
    last_seen: actor.lastSeen ?? null,
    sectors: actor.sectors,
    geographies: actor.geographies,
    tools: actor.tools,
    ttps: actor.ttps.map((t) => ({
      technique_id: t.techniqueId,
      technique_name: t.techniqueName,
      tactic: t.tactic,
    })),
    campaigns: actor.campaigns.map((c) => ({
      name: c.name,
      year: c.year ?? null,
      description: c.description,
    })),
    description: actor.description,
    tagline: actor.tagline ?? null,
    rarity: actor.rarity,
    image_url: actor.imageUrl ?? null,
    image_prompt: actor.imagePrompt ?? null,
    sources: actor.sources.map((s) => ({
      source: s.source,
      source_id: s.sourceId ?? null,
      fetched_at: s.fetchedAt,
      url: s.url ?? null,
    })),
    tlp: actor.tlp,
    intel_last_updated: actor.lastUpdated,
  }
}
