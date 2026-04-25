/**
 * ThreatDex backup utility.
 *
 * Usage:
 *   pnpm workers:backup -- --actor sandworm       # Backup single actor
 *   pnpm workers:backup -- --full                 # Backup all actors
 *   pnpm workers:backup -- --image <actor-id>     # Download actor image
 */

import { getSupabase } from "./shared/supabase.js"
import { promises as fs } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"

interface Options {
  actor?: string
  full?: boolean
  image?: string
}

async function main() {
  const { values } = parseArgs({
    options: {
      actor: { type: "string" },
      full: { type: "boolean", default: false },
      image: { type: "string" },
    },
  })

  const opts = values as Options
  const supabase = getSupabase()
  const backupDir = path.join(process.cwd(), "backups", new Date().toISOString().split("T")[0])

  await fs.mkdir(backupDir, { recursive: true })

  if (opts.actor) {
    await backupActor(opts.actor, backupDir, supabase)
  } else if (opts.full) {
    await backupAllActors(backupDir, supabase)
  } else if (opts.image) {
    await downloadActorImage(opts.image, backupDir, supabase)
  } else {
    console.error("Error: Specify --actor, --full, or --image")
    process.exit(1)
  }
}

async function backupActor(actorId: string, backupDir: string, supabase: ReturnType<typeof getSupabase>) {
  const { data, error } = await supabase
    .from("actors")
    .select("*")
    .eq("id", actorId)
    .maybeSingle()

  if (error || !data) {
    console.error(`Failed to fetch actor ${actorId}:`, error?.message ?? "not found")
    process.exit(1)
  }

  const outFile = path.join(backupDir, `${actorId}.json`)
  await fs.writeFile(outFile, JSON.stringify(data, null, 2))
  console.log(`Backed up actor ${actorId} to ${outFile}`)

  // Also download image if exists
  if (data.image_url) {
    await downloadActorImage(actorId, backupDir, supabase)
  }
}

async function backupAllActors(backupDir: string, supabase: ReturnType<typeof getSupabase>) {
  let allActors: unknown[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase
      .from("actors")
      .select("*")
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Failed to fetch actors:", error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) break

    allActors = allActors.concat(data)
    console.log(`Fetched ${data.length} actors (total: ${allActors.length})`)

    if (data.length < limit) break
    offset += limit
  }

  const outFile = path.join(backupDir, "actors-full.json")
  await fs.writeFile(outFile, JSON.stringify(allActors, null, 2))
  console.log(`Backed up ${allActors.length} actors to ${outFile}`)
}

async function downloadActorImage(actorId: string, backupDir: string, supabase: ReturnType<typeof getSupabase>) {
  const { data } = await supabase
    .from("actors")
    .select("image_url")
    .eq("id", actorId)
    .maybeSingle()

  if (!data?.image_url) {
    console.log(`No image for actor ${actorId}`)
    return
  }

  const imageUrl = data.image_url as string
  const response = await fetch(imageUrl)

  if (!response.ok) {
    console.warn(`Failed to download image for ${actorId}: ${response.status}`)
    return
  }

  const ext = path.extname(new URL(imageUrl).pathname) || ".png"
  const outFile = path.join(backupDir, `${actorId}${ext}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(outFile, buffer)
  console.log(`Downloaded image for ${actorId} to ${outFile}`)
}

main().catch(console.error)
