import type { ThreatActor } from "~/schema"

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function mapToActor(row: Record<string, unknown>): ThreatActor {
  const sources = asArray<Record<string, unknown>>(row.sources).map((source) => ({
    source: source.source as ThreatActor["sources"][number]["source"],
    sourceId: asOptionalString(source.sourceId ?? source.source_id),
    fetchedAt:
      asOptionalString(source.fetchedAt ?? source.fetched_at) ??
      asOptionalString(row.intel_last_updated ?? row.last_updated) ??
      new Date(0).toISOString(),
    url: asOptionalString(source.url),
  }))

  const ttps = asArray<Record<string, unknown>>(row.ttps).map((ttp) => ({
    techniqueId: asOptionalString(ttp.techniqueId ?? ttp.technique_id) ?? "",
    techniqueName: asOptionalString(ttp.techniqueName ?? ttp.technique_name) ?? "",
    tactic: asOptionalString(ttp.tactic) ?? "Unknown",
  }))

  return {
    id: row.id as string,
    canonicalName: row.canonical_name as string,
    aliases: asArray<string>(row.aliases),
    mitreId: asOptionalString(row.mitre_id),
    country: asOptionalString(row.country),
    countryCode: asOptionalString(row.country_code),
    motivation: asArray<ThreatActor["motivation"][number]>(row.motivation),
    threatLevel: (row.threat_level as number | undefined) ?? 1,
    sophistication: (row.sophistication as ThreatActor["sophistication"] | undefined) ?? "Low",
    firstSeen: asOptionalString(row.first_seen),
    lastSeen: asOptionalString(row.last_seen),
    sectors: asArray<string>(row.sectors),
    geographies: asArray<string>(row.geographies),
    tools: asArray<string>(row.tools),
    ttps,
    campaigns: asArray<ThreatActor["campaigns"][number]>(row.campaigns),
    description: (row.description as string | undefined) ?? "",
    tagline: asOptionalString(row.tagline),
    rarity: (row.rarity as ThreatActor["rarity"] | undefined) ?? "RARE",
    imageUrl: asOptionalString(row.image_url),
    imagePrompt: asOptionalString(row.image_prompt),
    sources,
    tlp: (row.tlp as ThreatActor["tlp"] | undefined) ?? "WHITE",
    lastUpdated:
      asOptionalString(row.last_updated ?? row.intel_last_updated) ??
      new Date(0).toISOString(),
    intelLastUpdated: asOptionalString(row.intel_last_updated),
    mediaLastUpdated: asOptionalString(row.media_last_updated),
    imageCurated: row.image_curated as boolean | undefined,
  }
}
