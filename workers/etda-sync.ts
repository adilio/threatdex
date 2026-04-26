/**
 * ETDA APT Groups scraper.
 *
 * Scrapes https://apt.etda.or.th/cgi-bin/listgroups.cgi for the list of groups
 * and https://apt.etda.or.th/cgi-bin/showcard.cgi?g={name} for details.
 *
 * The ETDA Thailand APT Groups database is a publicly accessible resource that
 * catalogues threat actor groups. This worker fetches the group list, then
 * retrieves the detail card for each group to build a ThreatActorData record.
 *
 * Usage:
 *   npx tsx workers/etda-sync.ts
 */

import * as cheerio from "cheerio"
import { logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { upsertActorPreservingMedia } from "./shared/upsert.js"
import { computeThreatLevel, computeRarity } from "./shared/rarity.js"
import type { ThreatActorData, TTPUsage, SourceAttribution } from "./shared/models.js"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ETDA_BASE_URL = "https://apt.etda.or.th"
const LIST_URL = `${ETDA_BASE_URL}/cgi-bin/listgroups.cgi`
const CARD_URL_TEMPLATE = `${ETDA_BASE_URL}/cgi-bin/showcard.cgi?g=`

const REQUEST_DELAY_MS = 500 // polite crawl delay

const USER_AGENT =
  "ThreatDex-Sync/1.0 (threat intelligence aggregator; https://github.com/threatdex/threatdex)"

// ---------------------------------------------------------------------------
// Country code lookup
// ---------------------------------------------------------------------------

const COUNTRY_CODES: Record<string, string> = {
  china: "CN",
  russia: "RU",
  iran: "IR",
  "north korea": "KP",
  vietnam: "VN",
  india: "IN",
  pakistan: "PK",
  turkey: "TR",
  israel: "IL",
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  "south korea": "KR",
  ukraine: "UA",
  bangladesh: "BD",
  nigeria: "NG",
  brazil: "BR",
  unknown: "",
}

const MOTIVATION_KEYWORDS: Record<string, string> = {
  espionage: "espionage",
  intelligence: "espionage",
  "information theft": "espionage",
  financial: "financial",
  fraud: "financial",
  banking: "financial",
  sabotage: "sabotage",
  disruption: "sabotage",
  destruction: "sabotage",
  hacktivism: "hacktivism",
  ideology: "hacktivism",
  military: "military",
  defense: "military",
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      console.warn(`HTTP ${response.status} fetching ${url}`)
      return null
    }
    return await response.text()
  } catch (err) {
    console.warn(`HTTP error fetching ${url}:`, err)
    return null
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function countryCode(countryName: string): string {
  return COUNTRY_CODES[countryName.toLowerCase().trim()] ?? ""
}

function mapMotivation(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const [keyword, motivation] of Object.entries(MOTIVATION_KEYWORDS)) {
    if (lower.includes(keyword) && !found.includes(motivation)) {
      found.push(motivation)
    }
  }
  return found.length > 0 ? found : ["espionage"]
}

function parseYear(text: string): string | undefined {
  const match = text.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : undefined
}

function parseTechniques(text: string): TTPUsage[] {
  const ttps: TTPUsage[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/\bT\d{4}(?:\.\d{3})?\b/g)) {
    const tid = match[0]
    if (!seen.has(tid)) {
      seen.add(tid)
      ttps.push({ techniqueId: tid, techniqueName: "", tactic: "" })
    }
  }
  return ttps
}

function slugifyActor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ---------------------------------------------------------------------------
// Public parsing functions
// ---------------------------------------------------------------------------

export function parseGroupList(html: string): string[] {
  const $ = cheerio.load(html)
  const groupNames: string[] = []

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? ""
    const title = $(el).attr("title") ?? ""
    if (!title.startsWith("Show the card for ")) return

    const match = href.match(/showcard\.cgi\?g=([^&"]+)/)
    if (match) {
      const name = decodeURIComponent(match[1].replace(/\+/g, " ")).trim()
      if (name && !groupNames.includes(name)) {
        groupNames.push(name)
      }
    }
  })

  console.log(`Parsed ${groupNames.length} group names from list page`)
  return groupNames
}

export function parseActorPage(
  html: string,
  groupName: string
): ThreatActorData | null {
  const $ = cheerio.load(html)

  // Extract canonical name
  let canonicalName = decodeURIComponent(groupName.replace(/\+/g, " ")).trim()
  const genericTitle = "Threat Group Cards: A Threat Actor Encyclopedia"

  const titleTag = $("title").first()
  if (titleTag.length) {
    const titleText = titleTag.text().trim()
    if (/^All groups\b/i.test(titleText)) {
      console.warn(`Skipping ETDA group list page accidentally parsed as actor: ${groupName}`)
      return null
    }
    if (titleText.includes(" - Threat Group Cards")) {
      canonicalName = titleText.split(" - Threat Group Cards")[0].trim()
    } else if (titleText.includes("|")) {
      canonicalName = titleText.split("|")[0].trim()
    } else if (titleText) {
      canonicalName = titleText.trim()
    }
  }

  // ETDA uses the h1 for the site name; h3 carries the card title.
  $("h2, h3").each((_i, el) => {
    const text = $(el).text().trim()
    const match = text.match(/^(?:APT group|Tool|Group):\s*(.+)$/i)
    if (match?.[1]) {
      canonicalName = match[1].trim()
      return false // break
    }
  })

  if (!canonicalName || canonicalName === genericTitle) {
    console.warn(`Could not determine canonical name for group ${groupName}`)
    return null
  }

  // Get full text for field inference
  const fullText = $.root().text().replace(/\s+/g, " ").trim()
  const lines = $("body")
    .text()
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  function tableValue(label: string): string {
    let value = ""
    $("tr").each((_i, row) => {
      const cells = $(row).find("td")
      const rowLabel = cells.first().text().replace(/\s+/g, " ").trim()
      if (rowLabel.toLowerCase() !== label.toLowerCase()) return
      value = cells
        .slice(1)
        .map((_j, cell) => $(cell).text().replace(/\s+/g, " ").trim())
        .get()
        .join(" ")
        .trim()
      return false
    })
    return value
  }

  // Aliases
  const aliases: string[] = []
  const namesValue = tableValue("Names")
  const decodedGroupParts = canonicalName.split(",").map((part) => part.trim()).filter(Boolean)
  if (decodedGroupParts.length > 1) {
    canonicalName = decodedGroupParts[0]
    aliases.push(...decodedGroupParts.slice(1))
  }
  if (namesValue) {
    for (const part of namesValue.split(/[,;]/)) {
      const trimmed = part
        .replace(/\([^)]*\)/g, "")
        .replace(/^["']|["']$/g, "")
        .trim()
      if (
        trimmed &&
        trimmed.toLowerCase() !== canonicalName.toLowerCase() &&
        !aliases.includes(trimmed)
      ) {
        aliases.push(trimmed)
      }
    }
  }

  const aliasLabelRe = /alias(?:es)?[:\s]+(.+)/i
  const akaRe = /also\s+known\s+as[:\s]+(.+)/i

  for (const line of lines) {
    const m = aliasLabelRe.exec(line)
    if (m) {
      for (const a of m[1].split(/[,;/]/)) {
        const trimmed = a.trim().replace(/^["']|["']$/g, "")
        if (
          trimmed &&
          trimmed.toLowerCase() !== canonicalName.toLowerCase() &&
          !aliases.includes(trimmed)
        ) {
          aliases.push(trimmed)
        }
      }
      break
    }
  }

  for (const line of lines) {
    const m = akaRe.exec(line)
    if (m) {
      for (const a of m[1].split(/[,;/]/)) {
        const trimmed = a.trim()
        if (
          trimmed &&
          trimmed.toLowerCase() !== canonicalName.toLowerCase() &&
          !aliases.includes(trimmed)
        ) {
          aliases.push(trimmed)
        }
      }
    }
  }

  // Country
  let country: string | undefined
  let countryCodeVal: string | undefined
  const countryValue = tableValue("Country").replace(/^\[|\]$/g, "")
  if (countryValue && countryValue.toLowerCase() !== "unknown") {
    country = countryValue
    const code = countryCode(countryValue)
    countryCodeVal = code || undefined
  }
  // Do not infer origin from arbitrary page text. ETDA pages include target
  // geographies in "Observed"; treating those as origin makes cards and image
  // prompts contradict the Background section.

  // Motivation
  const motivation = mapMotivation(tableValue("Motivation") || fullText)

  // Description — first substantial paragraph
  let description = tableValue("Description")
  $("p").each((_i, el) => {
    const text = $(el).text().trim()
    if (!description && text.length > 40 && !/^Last change to this card:/i.test(text)) {
      description = text
      return false // break
    }
  })
  if (!description) {
    description = fullText.slice(0, 500).trim()
  }

  // First / last seen years
  let firstSeen: string | undefined = parseYear(tableValue("First seen"))
  let lastSeen: string | undefined

  const firstSeenRe = /(?:first\s+seen|active\s+since|since)[:\s]*(.{0,30})/i
  const lastSeenRe = /(?:last\s+seen|last\s+active)[:\s]*(.{0,30})/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!firstSeen) {
      const m = firstSeenRe.exec(line)
      if (m) {
        const candidate = m[1].trim()
        firstSeen =
          parseYear(candidate) ??
          (i + 1 < lines.length ? parseYear(lines[i + 1]) : undefined)
      }
    }
    if (!lastSeen) {
      const m = lastSeenRe.exec(line)
      if (m) {
        const candidate = m[1].trim()
        lastSeen =
          parseYear(candidate) ??
          (i + 1 < lines.length ? parseYear(lines[i + 1]) : undefined)
      }
    }
  }

  // Sectors
  const sectors: string[] = []
  const sectorRe =
    /(?:target(?:ed)?\s+sector|industry|vertical)[:\s]+([^\n.]+)/i
  for (const line of lines) {
    const m = sectorRe.exec(line)
    if (m) {
      for (const s of m[1].split(/[,;]/)) {
        const trimmed = s.trim()
        if (trimmed && !sectors.includes(trimmed)) sectors.push(trimmed)
      }
      break
    }
  }

  // Tools
  const tools: string[] = []
  const toolsValue = tableValue("Tools used")
  if (toolsValue) {
    for (const t of toolsValue.replace(/\.$/, "").split(/[,;]/)) {
      const trimmed = t.trim()
      if (trimmed && !tools.includes(trimmed)) tools.push(trimmed)
    }
  }
  const toolsLabelRe = /^(?:tools?|malware|backdoor):?\s*$/i
  const toolsInlineRe = /(?:tools?|malware|backdoor)[:\s]+([^\n.]+)/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const mInline = toolsInlineRe.exec(line)
    if (mInline && mInline[1].trim()) {
      for (const t of mInline[1].split(/[,;]/)) {
        const trimmed = t.trim()
        if (trimmed && !tools.includes(trimmed)) tools.push(trimmed)
      }
      continue
    }
    if (toolsLabelRe.test(line.trim()) && i + 1 < lines.length) {
      for (const t of lines[i + 1].split(/[,;]/)) {
        const trimmed = t.trim()
        if (trimmed && !tools.includes(trimmed)) tools.push(trimmed)
      }
    }
  }

  // TTPs from technique references
  const ttps = parseTechniques(fullText)

  // Sophistication
  let sophistication = "Medium"
  const sophKeywords: Record<string, string> = {
    "nation-state": "Nation-State Elite",
    "nation state": "Nation-State Elite",
    "state-sponsored": "Nation-State Elite",
    "advanced persistent": "Very High",
    apt: "High",
    sophisticated: "High",
    basic: "Low",
    "script kiddie": "Low",
  }
  const descLower = description.toLowerCase()
  for (const [kw, tier] of Object.entries(sophKeywords)) {
    if (descLower.includes(kw)) {
      sophistication = tier
      break
    }
  }

  // Threat level + rarity
  const threatLevel = computeThreatLevel({
    sophistication,
    ttpsCount: ttps.length,
    campaignsCount: 0,
  })

  const sourceUrl = `${CARD_URL_TEMPLATE}${groupName}`
  const sources: SourceAttribution[] = [
    {
      source: "etda",
      sourceId: groupName,
      fetchedAt: nowIso(),
      url: sourceUrl,
    },
  ]

  const rarity = computeRarity({
    threatLevel,
    sophistication,
    sourcesCount: sources.length,
  })

  return {
    id: slugifyActor(canonicalName),
    canonicalName,
    aliases,
    country,
    countryCode: countryCodeVal,
    motivation,
    threatLevel,
    sophistication,
    firstSeen,
    lastSeen,
    sectors,
    geographies: [],
    tools,
    ttps,
    campaigns: [],
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
  const logId = await logSyncStart("etda")
  let recordsSynced = 0

  try {
    const listHtml = await fetchPage(LIST_URL)
    if (!listHtml) {
      throw new Error(`Failed to fetch group list from ${LIST_URL}`)
    }

    const groupNames = parseGroupList(listHtml)
    console.log(`Found ${groupNames.length} groups to process`)

    for (const groupName of groupNames) {
      await sleep(REQUEST_DELAY_MS)

      const cardUrl = `${CARD_URL_TEMPLATE}${groupName}`
      const cardHtml = await fetchPage(cardUrl)
      if (!cardHtml) {
        console.warn(`Skipping group ${groupName} — failed to fetch card page`)
        continue
      }

      try {
        const actor = parseActorPage(cardHtml, groupName)
        if (!actor) {
          console.warn(`Skipping group ${groupName} — parse returned null`)
          continue
        }

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
        console.warn(`Failed to process group ${groupName} — skipping:`, e)
      }
    }

    await logSyncComplete(logId, recordsSynced)
    console.log(`ETDA sync complete — ${recordsSynced} actors upserted`)
  } catch (e) {
    await logSyncError(logId, String(e))
    throw e
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
