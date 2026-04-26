/**
 * One-time cleanup script to remove OTX-sourced junk rows.
 *
 * These rows were created because OTX worker treated article titles as actor names.
 * This script safely deletes:
 * - Actors with only OTX as a source
 * - Name is >4 words OR contains sentence-like words
 *
 * Usage:
 *   pnpm workers:cleanup-otx -- --dry-run    # Preview what would be deleted
 *   pnpm workers:cleanup-otx                 # Actually delete
 */

import { getSupabase } from "./shared/supabase.js"
import { isLikelyPollutedOtxActorName } from "./shared/otx-filter.js"
import { parseArgs } from "node:util"

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: {
      "dry-run": { type: "boolean", default: false },
    },
  })

  const dryRun = values["dry-run"] as boolean
  const supabase = getSupabase()

  const { data: actors, error } = await supabase
    .from("actors")
    .select("id, canonical_name, sources")

  if (error) {
    console.error("Failed to fetch actors:", error.message)
    process.exit(1)
  }

  const toDelete = (actors ?? []).filter((a) => {
    const sources = (a.sources as { source: string }[]) ?? []
    if (sources.length === 0) return false
    // Only delete if ALL sources are OTX (don't delete multi-source actors)
    if (!sources.every((s) => s.source === "otx")) return false
    return isLikelyPollutedOtxActorName(a.canonical_name as string)
  })

  console.log(`Would delete ${toDelete.length} polluted rows`)
  if (dryRun) {
    toDelete.slice(0, 20).forEach((a) => {
      console.log(`  - ${a.id}: ${a.canonical_name}`)
    })
    if (toDelete.length > 20) {
      console.log(`  ... and ${toDelete.length - 20} more`)
    }
    return
  }

  let deleted = 0
  for (const a of toDelete) {
    const { error } = await supabase.from("actors").delete().eq("id", a.id)
    if (error) {
      console.warn(`Failed to delete ${a.id}:`, error.message)
    } else {
      deleted++
    }
  }
  console.log(`Deleted ${deleted} rows`)
}

main().catch(console.error)
