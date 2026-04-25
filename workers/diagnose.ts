/**
 * ThreatDex diagnostics utility.
 *
 * Usage:
 *   pnpm workers:diagnose                    # Human-readable output
 *   pnpm workers:diagnose -- --json         # JSON output
 *
 * Reports on:
 * - Total actor count
 * - Image coverage
 * - Intel staleness (actors not updated in 30+ days)
 * - Rarity distribution
 * - Sophistication distribution
 * - Source distribution
 */

import { getSupabase } from "./shared/supabase.js"
import { parseArgs } from "node:util"

interface Report {
  total: number
  withImage: number
  missingImage: number
  stale30: number
  stale90: number
  byRarity: Record<string, number>
  bySoph: Record<string, number>
  bySource: Record<string, number>
  intelLastUpdated?: {
    oldest: string
    newest: string
  }
  mediaLastUpdated?: {
    count: number
    newest: string
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      json: { type: "boolean", default: false },
    },
  })

  const json = values.json as boolean
  const supabase = getSupabase()

  // Select relevant fields for diagnostics
  const { data: actors, error } = await supabase
    .from("actors")
    .select("id, canonical_name, sophistication, rarity, image_url, intel_last_updated, media_last_updated, sources")

  if (error) {
    console.error("Failed to fetch actors:", error.message)
    process.exit(1)
  }

  if (!actors || actors.length === 0) {
    console.log("No actors found in database")
    return
  }

  const total = actors.length
  const withImage = actors.filter((a) => a.image_url).length
  const missingImage = total - withImage

  const now = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

  const stale30 = actors.filter((a) => {
    const t = a.intel_last_updated as string | null
    return t && now - new Date(t).getTime() > thirtyDaysMs
  }).length

  const stale90 = actors.filter((a) => {
    const t = a.intel_last_updated as string | null
    return t && now - new Date(t).getTime() > ninetyDaysMs
  }).length

  const byRarity: Record<string, number> = {}
  const bySoph: Record<string, number> = {}
  const bySource: Record<string, number> = {}

  let oldestIntel: string | null = null
  let newestIntel: string | null = null
  let mediaCount = 0
  let newestMedia: string | null = null

  for (const a of actors) {
    // Rarity distribution
    const rarity = (a.rarity as string) ?? "unknown"
    byRarity[rarity] = (byRarity[rarity] ?? 0) + 1

    // Sophistication distribution
    const soph = (a.sophistication as string) ?? "unknown"
    bySoph[soph] = (bySoph[soph] ?? 0) + 1

    // Source distribution
    const sources = (a.sources as { source: string }[]) ?? []
    for (const s of sources) {
      bySource[s.source] = (bySource[s.source] ?? 0) + 1
    }

    // Intel timestamps
    const intelTime = a.intel_last_updated as string | null
    if (intelTime) {
      if (!oldestIntel || new Date(intelTime) < new Date(oldestIntel)) {
        oldestIntel = intelTime
      }
      if (!newestIntel || new Date(intelTime) > new Date(newestIntel)) {
        newestIntel = intelTime
      }
    }

    // Media timestamps
    const mediaTime = a.media_last_updated as string | null
    if (mediaTime) {
      mediaCount++
      if (!newestMedia || new Date(mediaTime) > new Date(newestMedia)) {
        newestMedia = mediaTime
      }
    }
  }

  const report: Report = {
    total,
    withImage,
    missingImage,
    stale30,
    stale90,
    byRarity,
    bySoph,
    bySource,
  }

  if (oldestIntel) {
    report.intelLastUpdated = {
      oldest: oldestIntel,
      newest: newestIntel!,
    }
  }

  if (mediaCount > 0) {
    report.mediaLastUpdated = {
      count: mediaCount,
      newest: newestMedia!,
    }
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    formatHuman(report)
  }
}

function formatHuman(report: Report): void {
  console.log("╔════════════════════════════════════════════════════════════════╗")
  console.log("║                   ThreatDex Diagnostics                      ║")
  console.log("╚════════════════════════════════════════════════════════════════╝")
  console.log()

  console.log("📊 Data Volume")
  console.log("─".repeat(60))
  console.log(`  Total actors:           ${report.total}`)
  console.log(`  With images:            ${report.withImage} (${((report.withImage / report.total) * 100).toFixed(1)}%)`)
  console.log(`  Missing images:         ${report.missingImage} (${((report.missingImage / report.total) * 100).toFixed(1)}%)`)
  console.log()

  console.log("⏰ Freshness")
  console.log("─".repeat(60))
  console.log(`  Stale (30+ days):       ${report.stale30} (${((report.stale30 / report.total) * 100).toFixed(1)}%)`)
  console.log(`  Stale (90+ days):       ${report.stale90} (${((report.stale90 / report.total) * 100).toFixed(1)}%)`)
  if (report.intelLastUpdated) {
    console.log(`  Oldest intel:           ${report.intelLastUpdated.oldest?.split("T")[0]}`)
    console.log(`  Newest intel:           ${report.intelLastUpdated.newest?.split("T")[0]}`)
  }
  if (report.mediaLastUpdated) {
    console.log(`  Media refreshed:        ${report.mediaLastUpdated.count} actors`)
    console.log(`  Newest media:           ${report.mediaLastUpdated.newest?.split("T")[0]}`)
  }
  console.log()

  console.log("🏆 Rarity Distribution")
  console.log("─".repeat(60))
  const rarityOrder = ["MYTHIC", "LEGENDARY", "EPIC", "RARE"]
  for (const rarity of rarityOrder) {
    const count = report.byRarity[rarity] ?? 0
    const pct = ((count / report.total) * 100).toFixed(1)
    console.log(`  ${rarity.padEnd(12)} ${count.toString().padStart(5)} (${pct}%)`)
  }
  console.log()

  console.log("🎯 Sophistication Distribution")
  console.log("─".repeat(60))
  const sophOrder = ["Nation-State Elite", "Very High", "High", "Medium", "Low"]
  for (const soph of sophOrder) {
    const count = report.bySoph[soph] ?? 0
    const pct = ((count / report.total) * 100).toFixed(1)
    console.log(`  ${soph.padEnd(20)} ${count.toString().padStart(5)} (${pct}%)`)
  }
  console.log()

  console.log("📡 Source Distribution")
  console.log("─".repeat(60))
  const sourceEntries = Object.entries(report.bySource).sort((a, b) => b[1] - a[1])
  for (const [source, count] of sourceEntries) {
    const pct = ((count / report.total) * 100).toFixed(1)
    console.log(`  ${source.padEnd(10)} ${count.toString().padStart(5)} (${pct}%)`)
  }
  console.log()
}

main().catch(console.error)
