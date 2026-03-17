/**
 * AlienVault OTX connector.
 *
 * Feature-flagged: skips gracefully if OTX_API_KEY env var is not set.
 * Uses the OTX DirectConnect API to fetch threat actor pulses tagged with
 * "apt" or "threat-actor" and normalises them into ThreatActorData records.
 *
 * API reference: https://otx.alienvault.com/api/v1/
 *
 * Usage:
 *   OTX_API_KEY=<key> npx tsx workers/otx-sync.ts
 */

import { supabase, logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { findMatchingActor, mergeActors } from "./shared/dedup.js"
import { computeThreatLevel, computeRarity } from "./shared/rarity.js"
import { toDbRecord } from "./shared/models.js"
import type { ThreatActorData, TTPUsage, Campaign, SourceAttribution } from "./shared/models.js"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OTX_API_KEY = process.env.OTX_API_KEY
if (!OTX_API_KEY) {
  console.log("OTX_API_KEY not set — skipping OTX sync")
  process.exit(0)
}

const OTX_API_BASE = "https://otx.alienvault.com/api/v1"
const OTX_PULSE_ENDPOINT = `${OTX_API_BASE}/pulses/subscribed`

// Tags that indicate a pulse is about a threat actor rather than an IoC feed
const THREAT_ACTOR_TAGS = new Set([
  "apt",
  "threat-actor",
  "threat actor",
  "intrusion-set",
  "nation-state",
])

const PAGE_SIZE = 50

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OtxPulse = Record<string, any>

function isThreatActorPulse(pulse: OtxPulse): boolean {
  const tags: string[] = (pulse["tags"] ?? []).map((t: string) => t.toLowerCase())
  return tags.some((t) => THREAT_ACTOR_TAGS.has(t))
}

function cleanPulseName(name: string): string {
  // Remove trailing date / campaign noise
  name = name.replace(
    /\s*[-\u2013\u2014:]\s*(campaign|operation|activity|ioc|indicator).*$/i,
    ""
  )
  // Remove leading "Threat Actor:" / "APT Group:" prefixes
  name = name.replace(
    /^(threat\s+actor|apt\s+group|group|actor)\s*:\s*/i,
    ""
  )
  return name.trim()
}

function extractYear(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined
  const m = dateStr.match(/^(\d{4})/)
  return m ? m[1] : undefined
}

function mapAttackIds(attackIds: Record<string, string>[]): TTPUsage[] {
  const ttps: TTPUsage[] = []
  const seen = new Set<string>()
  for (const entry of attackIds) {
    const tid = (entry["id"] ?? "").trim()
    if (!tid || seen.has(tid)) continue
    seen.add(tid)
    ttps.push({
      techniqueId: tid,
      techniqueName: entry["display_name"] ?? "",
      tactic: entry["tactic"] ?? "",
    })
  }
  return ttps
}

function indicatorsToTools(indicators: Record<string, string>[]): string[] {
  const seen = new Set<string>()
  const tools: string[] = []
  for (const ind of indicators) {
    const itype = (ind["type"] ?? "").toLowerCase()
    if (itype === "hostname" || itype === "domain" || itype === "url") {
      const value: string = ind["indicator"] ?? ""
      if (value && !seen.has(value)) {
        seen.add(value)
        tools.push(value)
      }
    }
  }
  return tools
}

// ---------------------------------------------------------------------------
// OTX API client
// ---------------------------------------------------------------------------

async function fetchSubscribedPulses(
  page: number,
  limit: number
): Promise<OtxPulse> {
  const url = new URL(OTX_PULSE_ENDPOINT)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("page", String(page))

  const response = await fetch(url.toString(), {
    headers: {
      "X-OTX-API-KEY": OTX_API_KEY!,
      "User-Agent": "ThreatDex-Sync/1.0",
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`OTX API HTTP ${response.status} on page ${page}`)
  }
  return (await response.json()) as OtxPulse
}

async function* iterThreatActorPulses(): AsyncGenerator<OtxPulse> {
  let page = 1
  let totalFetched = 0

  while (true) {
    let data: OtxPulse
    try {
      data = await fetchSubscribedPulses(page, PAGE_SIZE)
    } catch (err) {
      console.error(`OTX API request failed on page ${page}:`, err)
      break
    }

    const results: OtxPulse[] = data["results"] ?? []
    if (results.length === 0) break

    for (const pulse of results) {
      if (isThreatActorPulse(pulse)) {
        yield pulse
        totalFetched++
      }
    }

    if (!data["next"]) break
    page++
  }

  console.log(`Fetched ${totalFetched} threat-actor pulses from OTX`)
}

// ---------------------------------------------------------------------------
// Pulse → ThreatActorData conversion
// ---------------------------------------------------------------------------

function parsePulse(pulse: OtxPulse): ThreatActorData | null {
  const name = cleanPulseName(pulse["name"] ?? "")
  if (!name) return null

  const description: string = pulse["description"] ?? ""
  const tags: string[] = pulse["tags"] ?? []
  const indicators: Record<string, string>[] = pulse["indicators"] ?? []
  const attackIds: Record<string, string>[] = pulse["attack_ids"] ?? []
  const pulseId: string = pulse["id"] ?? ""
  const created: string = pulse["created"] ?? ""
  const modified: string = pulse["modified"] ?? ""

  // Treat each unique pulse as a campaign
  const campaigns: Campaign[] = [
    {
      name: pulse["name"] ?? name,
      year: extractYear(created),
      description: description.slice(0, 300),
    },
  ]

  const ttps = mapAttackIds(attackIds)
  const tools = indicatorsToTools(indicators)

  // Infer motivation from tags and description
  const motivation: string[] = []
  const combinedText = tags.join(" ").toLowerCase() + " " + description.toLowerCase()
  const motivationMap: Record<string, string> = {
    espionage: "espionage",
    financial: "financial",
    sabotage: "sabotage",
    hacktivism: "hacktivism",
    military: "military",
  }
  for (const [keyword, value] of Object.entries(motivationMap)) {
    if (combinedText.includes(keyword) && !motivation.includes(value)) {
      motivation.push(value)
    }
  }
  if (motivation.length === 0) motivation.push("espionage")

  const sophistication = "High" // OTX actor pulses are typically about notable groups

  const threatLevel = computeThreatLevel({
    sophistication,
    ttpsCount: ttps.length,
    campaignsCount: campaigns.length,
  })

  const sources: SourceAttribution[] = [
    {
      source: "otx",
      sourceId: pulseId,
      fetchedAt: nowIso(),
      url: pulseId
        ? `https://otx.alienvault.com/pulse/${pulseId}`
        : undefined,
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
    aliases: [],
    motivation,
    threatLevel,
    sophistication,
    firstSeen: extractYear(created),
    lastSeen: extractYear(modified),
    sectors: [],
    geographies: [],
    tools,
    ttps,
    campaigns,
    description,
    rarity,
    sources,
    tlp: "WHITE",
    lastUpdated: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const logId = await logSyncStart("otx")
  let recordsSynced = 0

  try {
    for await (const pulse of iterThreatActorPulses()) {
      try {
        let actor = parsePulse(pulse)
        if (!actor) continue

        const existingId = await findMatchingActor(actor)
        if (existingId && existingId !== actor.id) {
          const { data: existingRow } = await supabase
            .from("actors")
            .select("*")
            .eq("id", existingId)
            .single()
          if (existingRow) {
            actor = mergeActors(existingRow as Record<string, unknown>, actor)
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
          `Failed to process pulse ${pulse["id"] ?? "unknown"} — skipping:`,
          e
        )
      }
    }

    await logSyncComplete(logId, recordsSynced)
    console.log(`OTX sync complete — ${recordsSynced} actors upserted`)
  } catch (e) {
    await logSyncError(logId, String(e))
    throw e
  }
}

main().catch(console.error)
