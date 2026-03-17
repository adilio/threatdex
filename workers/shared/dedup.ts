/**
 * Deduplication and merge logic for ThreatDex actors.
 *
 * Provides:
 * - normalizeName()      — canonical string form for name matching
 * - findMatchingActor()  — look up an existing actor by name / alias
 * - mergeActors()        — combine existing DB record with new ingest data
 */

import { supabase } from "./supabase.js"
import type { ThreatActorData, TTPUsage, Campaign, SourceAttribution } from "./models.js"

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

const PUNCT_RE = /[^\w\s]/gu
const SPACE_RE = /\s+/g
const STRIP_PREFIXES = /^(apt|group|threat group|ta|unc|fin|g)\s*/i

/**
 * Return a canonical lowercase form of name for fuzzy matching.
 *
 * Steps:
 * 1. Lowercase.
 * 2. Strip leading/trailing whitespace.
 * 3. Remove all punctuation characters.
 * 4. Collapse multiple spaces to one.
 * 5. Strip common threat-actor name prefixes (APT, TA, FIN, …).
 */
export function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim()
  normalized = normalized.replace(PUNCT_RE, "")
  normalized = normalized.replace(SPACE_RE, " ").trim()
  normalized = normalized.replace(STRIP_PREFIXES, "").trim()
  return normalized
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Return the existing actor ID if a matching record is found in the DB.
 *
 * Matching strategy (in order):
 * 1. Exact slug match on id.
 * 2. Normalised name match against canonical names.
 * 3. Normalised name match against any element of the aliases array.
 */
export async function findMatchingActor(
  actor: ThreatActorData
): Promise<string | null> {
  const candidateNames = [actor.canonicalName, ...actor.aliases]
  const normalisedCandidates = new Set(
    candidateNames.filter(Boolean).map(normalizeName)
  )

  try {
    // 1. Exact slug match
    const { data: exactRow } = await supabase
      .from("actors")
      .select("id")
      .eq("id", actor.id)
      .maybeSingle()

    if (exactRow) {
      return exactRow.id as string
    }

    // 2. Normalised canonical name match
    const { data: allActors } = await supabase
      .from("actors")
      .select("id, canonical_name, aliases")

    if (allActors) {
      for (const row of allActors) {
        const dbName: string = row.canonical_name ?? ""
        if (dbName && normalisedCandidates.has(normalizeName(dbName))) {
          return row.id as string
        }
      }

      // 3. Match against aliases
      for (const row of allActors) {
        const dbAliases: string[] = Array.isArray(row.aliases) ? row.aliases : []
        for (const alias of dbAliases) {
          if (alias && normalisedCandidates.has(normalizeName(alias))) {
            return row.id as string
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      `findMatchingActor failed for ${actor.id} — treating as new actor:`,
      err
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

function unionList<T>(existing: T[], incoming: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of [...existing, ...incoming]) {
    const key = String(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }
  return result
}

function unionTtps(existing: TTPUsage[], incoming: TTPUsage[]): TTPUsage[] {
  const seen = new Set<string>()
  const result: TTPUsage[] = []
  for (const ttp of [...existing, ...incoming]) {
    if (!seen.has(ttp.techniqueId)) {
      seen.add(ttp.techniqueId)
      result.push(ttp)
    }
  }
  return result
}

function unionCampaigns(existing: Campaign[], incoming: Campaign[]): Campaign[] {
  const seen = new Set<string>(existing.map((c) => c.name.toLowerCase()))
  const result: Campaign[] = [...existing]
  for (const c of incoming) {
    if (!seen.has(c.name.toLowerCase())) {
      seen.add(c.name.toLowerCase())
      result.push(c)
    }
  }
  return result
}

function unionSources(
  existing: SourceAttribution[],
  incoming: SourceAttribution[]
): SourceAttribution[] {
  const bySource = new Map<string, SourceAttribution>()
  for (const s of existing) {
    bySource.set(s.source, s)
  }
  for (const s of incoming) {
    bySource.set(s.source, s) // always take the fresher record
  }
  return Array.from(bySource.values())
}

function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const v of values) {
    if (v !== null && v !== undefined && v !== ("" as unknown as T)) {
      const asArr = v as unknown as unknown[]
      if (Array.isArray(asArr) && asArr.length === 0) continue
      return v as T
    }
  }
  return values[values.length - 1] as T | undefined
}

/**
 * Merge an existing DB actor record with freshly ingested data.
 *
 * Strategy:
 * - Scalar fields: keep the new value when non-null/non-empty, otherwise fall
 *   back to the existing value.
 * - List fields (aliases, sectors, geographies, tools): union.
 * - TTPs: union by techniqueId.
 * - Campaigns: union by campaign name (case-insensitive).
 * - Sources: merge by source key, always taking the fresher record.
 * - threatLevel: take the maximum.
 * - lastUpdated: always use current UTC timestamp.
 */
export function mergeActors(
  existing: Record<string, unknown>,
  incoming: ThreatActorData
): ThreatActorData {
  // Reconstruct nested objects from the existing record
  const existingTtps: TTPUsage[] = ((existing.ttps as Record<string, string>[] | null) ?? []).map(
    (t) => ({
      techniqueId: t["technique_id"] ?? "",
      techniqueName: t["technique_name"] ?? "",
      tactic: t["tactic"] ?? "",
    })
  )

  const existingCampaigns: Campaign[] = (
    (existing.campaigns as Record<string, string>[] | null) ?? []
  ).map((c) => ({
    name: c["name"] ?? "",
    description: c["description"] ?? "",
    year: c["year"] ?? undefined,
  }))

  const existingSources: SourceAttribution[] = (
    (existing.sources as Record<string, string>[] | null) ?? []
  ).map((s) => ({
    source: s["source"] as SourceAttribution["source"],
    fetchedAt: s["fetched_at"] ?? "",
    sourceId: s["source_id"] ?? undefined,
    url: s["url"] ?? undefined,
  }))

  return {
    id: (existing.id as string | undefined) ?? incoming.id,
    canonicalName:
      coalesce(existing.canonical_name as string, incoming.canonicalName) ??
      incoming.canonicalName,
    description:
      coalesce(incoming.description, existing.description as string) ?? "",
    aliases: unionList(
      (existing.aliases as string[] | null) ?? [],
      incoming.aliases
    ),
    mitreId: coalesce(incoming.mitreId, existing.mitre_id as string),
    country: coalesce(incoming.country, existing.country as string),
    countryCode: coalesce(incoming.countryCode, existing.country_code as string),
    motivation: unionList(
      (existing.motivation as string[] | null) ?? [],
      incoming.motivation
    ),
    threatLevel: Math.max(
      (existing.threat_level as number | null) ?? 1,
      incoming.threatLevel
    ),
    sophistication:
      coalesce(incoming.sophistication, existing.sophistication as string) ??
      "Low",
    firstSeen: coalesce(incoming.firstSeen, existing.first_seen as string),
    lastSeen: coalesce(incoming.lastSeen, existing.last_seen as string),
    sectors: unionList(
      (existing.sectors as string[] | null) ?? [],
      incoming.sectors
    ),
    geographies: unionList(
      (existing.geographies as string[] | null) ?? [],
      incoming.geographies
    ),
    tools: unionList(
      (existing.tools as string[] | null) ?? [],
      incoming.tools
    ),
    ttps: unionTtps(existingTtps, incoming.ttps),
    campaigns: unionCampaigns(existingCampaigns, incoming.campaigns),
    tagline: coalesce(incoming.tagline, existing.tagline as string),
    rarity:
      coalesce(incoming.rarity, existing.rarity as ThreatActorData["rarity"]) ??
      "RARE",
    imageUrl: coalesce(
      existing.image_url as string,
      incoming.imageUrl
    ),
    imagePrompt: coalesce(
      existing.image_prompt as string,
      incoming.imagePrompt
    ),
    sources: unionSources(existingSources, incoming.sources),
    tlp:
      coalesce(incoming.tlp, existing.tlp as ThreatActorData["tlp"]) ?? "WHITE",
    lastUpdated: new Date().toISOString(),
  }
}
