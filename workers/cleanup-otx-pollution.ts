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
import { parseArgs } from "node:util"

const SENTENCE_RE = /\b(the|and|with|by|targeting|inside|using|advisory|chronology|operation|unmasking|fake|new|attack|attacks|expands|targeted|reveals|infects|executed|uncovers|delivers|escalation|implant|implants|backdoor|campaign|variant|techniques|deployed|leverages)\b/i

async function main() {
  const { values } = parseArgs({
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
    const wordCount = (a.canonical_name as string).split(/\s+/).length
    return wordCount > 4 || SENTENCE_RE.test(a.canonical_name as string)
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
