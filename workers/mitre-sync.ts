/**
 * MITRE ATT&CK STIX bundle ingestion worker.
 *
 * Pulls intrusion-set objects from the MITRE ATT&CK STIX bundle hosted at:
 *   https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json
 *
 * This approach is more reliable than live TAXII queries in CI/CD environments
 * because it does not require authentication and is served from a CDN.
 *
 * Usage:
 *   npx tsx workers/mitre-sync.ts
 */

import { supabase, logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { findMatchingActor, mergeActors } from "./shared/dedup.js"
import { computeThreatLevel, computeRarity } from "./shared/rarity.js"
import { toDbRecord } from "./shared/models.js"
import type { ThreatActorData, TTPUsage, Campaign, SourceAttribution } from "./shared/models.js"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STIX_BUNDLE_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"

const MITRE_ATTACK_BASE_URL = "https://attack.mitre.org/groups/"

// ---------------------------------------------------------------------------
// Motivation mapping
// ---------------------------------------------------------------------------

const MOTIVATION_MAP: Record<string, string> = {
  espionage: "espionage",
  "cyber espionage": "espionage",
  "state-sponsored": "espionage",
  "financial gain": "financial",
  financial: "financial",
  sabotage: "sabotage",
  destruction: "sabotage",
  disruption: "sabotage",
  hacktivism: "hacktivism",
  ideology: "hacktivism",
  "military advantage": "military",
  military: "military",
}

const SOPHISTICATION_MAP: Record<string, string> = {
  none: "Low",
  minimal: "Low",
  intermediate: "Medium",
  advanced: "High",
  expert: "Very High",
  innovator: "Nation-State Elite",
  strategic: "Nation-State Elite",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString()
}

function slugifyActor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function mapMotivation(rawValues: string[]): string[] {
  const result: string[] = []
  for (const v of rawValues) {
    const mapped = MOTIVATION_MAP[v.toLowerCase().trim()]
    if (mapped && !result.includes(mapped)) {
      result.push(mapped)
    }
  }
  return result.length > 0 ? result : ["espionage"]
}

function mapSophistication(raw: string | null | undefined): string {
  if (!raw) return "High"
  return SOPHISTICATION_MAP[raw.toLowerCase().trim()] ?? "High"
}

function extractMitreId(
  externalRefs: Record<string, string>[]
): string | undefined {
  for (const ref of externalRefs) {
    if (ref["source_name"] === "mitre-attack") {
      return ref["external_id"] ?? undefined
    }
  }
  return undefined
}

function extractMitreUrl(
  externalRefs: Record<string, string>[]
): string | undefined {
  for (const ref of externalRefs) {
    if (ref["source_name"] === "mitre-attack") {
      const extId = ref["external_id"] ?? ""
      if (extId) return `${MITRE_ATTACK_BASE_URL}${extId}/`
    }
  }
  return undefined
}

function extractYear(stixTimestamp: string | null | undefined): string | undefined {
  if (!stixTimestamp) return undefined
  const match = stixTimestamp.match(/^(\d{4})/)
  return match ? match[1] : undefined
}

function inferCountryFromLabels(
  labels: string[],
  description: string
): [string | undefined, string | undefined] {
  const countryHints: Record<string, [string, string]> = {
    russia: ["Russia", "RU"],
    russian: ["Russia", "RU"],
    china: ["China", "CN"],
    chinese: ["China", "CN"],
    iran: ["Iran", "IR"],
    iranian: ["Iran", "IR"],
    "north korea": ["North Korea", "KP"],
    dprk: ["North Korea", "KP"],
    lazarus: ["North Korea", "KP"],
    vietnam: ["Vietnam", "VN"],
    vietnamese: ["Vietnam", "VN"],
    india: ["India", "IN"],
    pakistan: ["Pakistan", "PK"],
    turkey: ["Turkey", "TR"],
    turkish: ["Turkey", "TR"],
    israel: ["Israel", "IL"],
    "united states": ["United States", "US"],
    "united kingdom": ["United Kingdom", "GB"],
  }
  const textToSearch =
    labels.join(" ").toLowerCase() + " " + description.toLowerCase()
  for (const [hint, [country, code]] of Object.entries(countryHints)) {
    if (textToSearch.includes(hint)) {
      return [country, code]
    }
  }
  return [undefined, undefined]
}

// ---------------------------------------------------------------------------
// STIX bundle parsing
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StixObject = Record<string, any>

async function fetchStixBundle(url: string = STIX_BUNDLE_URL): Promise<StixObject> {
  console.log(`Fetching STIX bundle from ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching STIX bundle from ${url}`)
  }
  const bundle = (await response.json()) as StixObject
  console.log(
    `Fetched STIX bundle — ${(bundle.objects as unknown[])?.length ?? 0} objects total`
  )
  return bundle
}

function indexBundle(objects: StixObject[]): {
  byId: Map<string, StixObject>
  intrusionSets: StixObject[]
  relsBySource: Map<string, StixObject[]>
  relsByTarget: Map<string, StixObject[]>
} {
  const byId = new Map<string, StixObject>()
  const intrusionSets: StixObject[] = []
  const relsBySource = new Map<string, StixObject[]>()
  const relsByTarget = new Map<string, StixObject[]>()

  for (const obj of objects) {
    const stixId: string = obj["id"] ?? ""
    byId.set(stixId, obj)

    if (obj["type"] === "intrusion-set") {
      intrusionSets.push(obj)
    }

    if (obj["type"] === "relationship") {
      const src: string = obj["source_ref"] ?? ""
      const tgt: string = obj["target_ref"] ?? ""
      if (!relsBySource.has(src)) relsBySource.set(src, [])
      relsBySource.get(src)!.push(obj)
      if (!relsByTarget.has(tgt)) relsByTarget.set(tgt, [])
      relsByTarget.get(tgt)!.push(obj)
    }
  }

  return { byId, intrusionSets, relsBySource, relsByTarget }
}

function parseIntrusionSet(
  obj: StixObject,
  byId: Map<string, StixObject>,
  relsBySource: Map<string, StixObject[]>,
  relsByTarget: Map<string, StixObject[]>
): ThreatActorData {
  const stixId: string = obj["id"] ?? ""
  const name: string = obj["name"] ?? "Unknown"
  const description: string = obj["description"] ?? ""
  const labels: string[] = obj["labels"] ?? []
  const externalRefs: Record<string, string>[] = obj["external_references"] ?? []
  const rawAliases: string[] = obj["aliases"] ?? obj["x_mitre_aliases"] ?? []
  const aliases = rawAliases.filter((a) => a && a !== name)

  const mitreId = extractMitreId(externalRefs)
  const mitreUrl = extractMitreUrl(externalRefs)

  const sophisticationRaw: string | undefined =
    obj["x_mitre_version"] ?? obj["sophistication"] ?? undefined
  const sophistication = mapSophistication(sophisticationRaw)

  const rawMotivations: string[] =
    obj["x_mitre_motivation_types"] ??
    obj["primary_motivation_types"] ??
    []
  const motivation = mapMotivation(rawMotivations)

  const firstSeen = extractYear(obj["first_seen"] ?? obj["created"])
  const lastSeen = extractYear(obj["last_seen"] ?? obj["modified"])

  const sectors: string[] = obj["x_mitre_sectors"] ?? []
  const [country, countryCode] = inferCountryFromLabels(labels, description)

  // TTPs: "uses" relationships where target is attack-pattern
  const ttps: TTPUsage[] = []
  for (const rel of relsBySource.get(stixId) ?? []) {
    if (rel["relationship_type"] !== "uses") continue
    const target = byId.get(rel["target_ref"] ?? "")
    if (!target || target["type"] !== "attack-pattern") continue
    const techniqueId = extractMitreId(target["external_references"] ?? [])
    if (!techniqueId) continue
    const killChainPhases: Record<string, string>[] =
      target["kill_chain_phases"] ?? []
    const tactic =
      killChainPhases.length > 0
        ? (killChainPhases[0]["phase_name"] ?? "")
        : ""
    ttps.push({
      techniqueId,
      techniqueName: target["name"] ?? "",
      tactic,
    })
  }

  // Tools: "uses" relationships where target is tool/malware
  const tools: string[] = []
  for (const rel of relsBySource.get(stixId) ?? []) {
    if (rel["relationship_type"] !== "uses") continue
    const target = byId.get(rel["target_ref"] ?? "")
    if (!target) continue
    if (target["type"] === "tool" || target["type"] === "malware") {
      const toolName: string = target["name"] ?? ""
      if (toolName && !tools.includes(toolName)) {
        tools.push(toolName)
      }
    }
  }

  // Campaigns: attributed-to or targets relationships
  const campaigns: Campaign[] = []
  for (const rel of relsByTarget.get(stixId) ?? []) {
    if (
      rel["relationship_type"] !== "attributed-to" &&
      rel["relationship_type"] !== "targets"
    ) {
      continue
    }
    const srcObj = byId.get(rel["source_ref"] ?? "")
    if (!srcObj || srcObj["type"] !== "campaign") continue
    const campYear = extractYear(
      srcObj["first_seen"] ?? srcObj["created"] ?? undefined
    )
    campaigns.push({
      name: srcObj["name"] ?? "Unknown Campaign",
      year: campYear,
      description: srcObj["description"] ?? "",
    })
  }

  const threatLevel = computeThreatLevel({
    sophistication,
    ttpsCount: ttps.length,
    campaignsCount: campaigns.length,
  })

  const sources: SourceAttribution[] = [
    {
      source: "mitre",
      sourceId: mitreId,
      fetchedAt: nowIso(),
      url: mitreUrl,
    },
  ]

  const rarity = computeRarity({
    threatLevel,
    sophistication,
    sourcesCount: sources.length,
  })

  return {
    id: slugifyActor(name),
    canonicalName: name,
    aliases,
    mitreId,
    country,
    countryCode,
    motivation,
    threatLevel,
    sophistication,
    firstSeen,
    lastSeen,
    sectors,
    geographies: [],
    tools,
    ttps,
    campaigns,
    description,
    tagline: undefined,
    rarity,
    imageUrl: undefined,
    imagePrompt: undefined,
    sources,
    tlp: "WHITE",
    lastUpdated: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const logId = await logSyncStart("mitre")
  let recordsSynced = 0

  try {
    const bundle = await fetchStixBundle()
    const objects: StixObject[] = bundle["objects"] ?? []

    const { byId, intrusionSets, relsBySource, relsByTarget } =
      indexBundle(objects)
    console.log(`Found ${intrusionSets.length} intrusion-set objects`)

    for (const obj of intrusionSets) {
      try {
        let actor = parseIntrusionSet(obj, byId, relsBySource, relsByTarget)

        const existingId = await findMatchingActor(actor)
        if (existingId && existingId !== actor.id) {
          const { data: existingRow } = await supabase
            .from("actors")
            .select("*")
            .eq("id", existingId)
            .single()
          if (existingRow) {
            actor = mergeActors(
              existingRow as Record<string, unknown>,
              actor
            )
          }
        }

        const { error } = await supabase
          .from("actors")
          .upsert(toDbRecord(actor), { onConflict: "id" })

        if (error) {
          console.warn(
            `Supabase upsert error for ${actor.canonicalName}:`,
            error.message
          )
        } else {
          recordsSynced++
        }
      } catch (e) {
        console.warn(
          `Failed to process intrusion-set ${obj["name"] ?? obj["id"]} — skipping:`,
          e
        )
      }
    }

    await logSyncComplete(logId, recordsSynced)
    console.log(`MITRE sync complete — ${recordsSynced} actors upserted`)
  } catch (e) {
    await logSyncError(logId, String(e))
    throw e
  }
}

main().catch(console.error)
