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

import { logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { upsertActorPreservingMedia } from "./shared/upsert.js"
import { computeThreatLevel, computeRarity } from "./shared/rarity.js"
import {
  cleanPulseName,
  extractActorCandidate,
  looksLikeActorName,
} from "./shared/otx-filter.js"
import type { ThreatActorData, TTPUsage, Campaign, SourceAttribution } from "./shared/models.js"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OTX_API_KEY = process.env.OTX_API_KEY

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
  const candidateName = extractActorCandidate(pulse)
  if (!candidateName) return null

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
      name: pulse["name"] ?? candidateName,
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

  // Derive sophistication from signal strength, not hardcoded
  const isStateSponsored = /nation-state|state.sponsored|apt|apt\d+/i.test(combinedText)
  const sophistication = deriveSophistication({
    ttpsCount: ttps.length,
    campaignsCount: campaigns.length,
    toolsCount: tools.length,
    isStateSponsored,
  })

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
    id: slugifyActor(candidateName),
    canonicalName: candidateName,
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

/**
 * Derive sophistication from observable signals.
 * OTX pulses don't have explicit sophistication, so we infer from TTPs, campaigns, and state-sponsorship signals.
 */
function deriveSophistication(params: {
  ttpsCount: number
  campaignsCount: number
  toolsCount: number
  isStateSponsored: boolean
}): string {
  const { ttpsCount, campaignsCount, toolsCount, isStateSponsored } = params
  const score = ttpsCount + campaignsCount * 2 + toolsCount * 0.5 + (isStateSponsored ? 10 : 0)
  if (score >= 30 && isStateSponsored) return "Nation-State Elite"
  if (score >= 20) return "Very High"
  if (score >= 10) return "High"
  if (score >= 4) return "Medium"
  return "Low"
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!OTX_API_KEY) {
    console.log("OTX_API_KEY not set — skipping OTX sync")
    return
  }

  const logId = await logSyncStart("otx")
  let recordsSynced = 0

  try {
    for await (const pulse of iterThreatActorPulses()) {
      try {
        const actor = parsePulse(pulse)
        if (!actor) continue

        const result = await upsertActorPreservingMedia(actor)
        if (result.error) {
          console.warn(
            `Upsert error for ${actor.canonicalName}:`,
            result.error
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { cleanPulseName, extractActorCandidate, looksLikeActorName, parsePulse }
