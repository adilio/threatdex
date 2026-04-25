/**
 * AI hero image generation worker.
 *
 * Multi-provider support:
 * - Google Gemini Imagen 3 (recommended, ~$0.04/image)
 * - Hugging Face Inference (free tier available)
 * - Stable Horde (free, community-powered)
 * - OpenAI DALL-E (legacy support)
 *
 * Images are persisted to Supabase Storage, not temporary URLs.
 *
 * Usage:
 *   pnpm workers:image                                         # fill missing only
 *   pnpm workers:image -- --actor sandworm --dry-run           # show prompt
 *   pnpm workers:image -- --actor sandworm --force             # regenerate one
 *   pnpm workers:image -- --top 25 --exclude sandworm          # batch top 25
 *   pnpm workers:image -- --limit 10                           # cap batch size
 *   pnpm workers:image -- --provider stable-horde              # cheap mode
 */

import { parseArgs } from "node:util"
import { createHash } from "node:crypto"
import { getSupabase } from "./shared/supabase.js"
import { selectProvider, getProviderByName, type ImageProvider } from "./image-providers/index.js"
import { buildImagePrompt } from "./image-prompts.js"

// ---------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ProcessResult {
  status: "ok" | "skipped" | "failed" | "dry-run"
  error?: string
}

interface CliOptions {
  actor?: string
  top?: string
  limit?: string
  force?: boolean
  dryRun?: boolean
  provider?: string
  exclude?: string[]
}

// ---------------------------------------------------------------------------
// Supabase Storage helpers
// ----------------------------------------------------------------------------

/**
 * Upload image bytes to Supabase Storage and return public URL.
 * Uses hash in path for idempotency — same prompt+seed = same file.
 */
async function uploadToStorage(
  actorId: string,
  bytes: Buffer
): Promise<{ url: string; path: string } | null> {
  const supabase = getSupabase()
  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 12)
  const path = `actors/${actorId}/${hash}.png`

  try {
    const { error } = await supabase.storage
      .from("actor-images")
      .upload(path, bytes, {
        contentType: "image/png",
        upsert: false, // Don't overwrite existing images
      })

    // If file already exists, that's actually fine — we got the same image
    if (error && !error.message.includes("already exists")) {
      console.error(`Storage upload failed for ${actorId}:`, error.message)
      return null
    }

    const { data } = supabase.storage.from("actor-images").getPublicUrl(path)
    return { url: data.publicUrl, path }
  } catch (error) {
    console.error(`Storage upload error for ${actorId}:`, error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Should-skip logic
// ----------------------------------------------------------------------------

function shouldSkip(actor: Record<string, unknown>, opts: CliOptions): boolean {
  // Force flag overrides everything
  if (opts.force) return false

  // Skip curated actors
  if (actor.image_curated === true) {
    return true
  }

  // Skip if already has an image (unless force is set)
  if (actor.image_url) {
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Actor processing
// ----------------------------------------------------------------------------

async function processActor(
  actor: Record<string, unknown>,
  provider: ImageProvider,
  opts: CliOptions
): Promise<ProcessResult> {
  const actorId = String(actor.id ?? "unknown")

  if (shouldSkip(actor, opts)) {
    return { status: "skipped" }
  }

  const prompt = buildImagePrompt(actor)

  if (opts.dryRun) {
    console.log(`[dry-run] ${actorId}: ${prompt}`)
    return { status: "dry-run" }
  }

  console.log(`Generating image for ${actorId}...`)

  // Generate image bytes
  const bytes = await provider.generate(prompt)
  if (!bytes) {
    return { status: "failed", error: "Provider returned no image data" }
  }

  // Upload to Supabase Storage
  const storageResult = await uploadToStorage(actorId, bytes)
  if (!storageResult) {
    return { status: "failed", error: "Storage upload failed" }
  }

  // Update database
  const supabase = getSupabase()
  const { error } = await supabase
    .from("actors")
    .update({
      image_url: storageResult.url,
      image_prompt: prompt,
      image_storage_path: storageResult.path,
      image_provider: provider.name,
      image_generated_at: new Date().toISOString(),
      media_last_updated: new Date().toISOString(),
    })
    .eq("id", actorId)

  if (error) {
    return { status: "failed", error: error.message }
  }

  console.log(`✓ ${actorId}: ${storageResult.url}`)
  return { status: "ok" }
}

// ---------------------------------------------------------------------------
// Actor fetching
// ----------------------------------------------------------------------------

async function fetchActors(opts: CliOptions): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase()

  // Single actor mode
  if (opts.actor) {
    const { data, error } = await supabase
      .from("actors")
      .select("*")
      .eq("id", opts.actor)
      .maybeSingle()

    if (error || !data) {
      throw new Error(`Actor '${opts.actor}' not found`)
    }
    return [data as Record<string, unknown>]
  }

  // Batch mode
  let query = supabase
    .from("actors")
    .select("*")

  // Top-N mode: order by interestingness
  if (opts.top) {
    // Order by rarity rank, threat_level, sources count, then name
    query = query.order("threat_level", { ascending: false })
  }

  // Only fetch actors without images
  query = query.is("image_url", null)

  // Apply limit
  const limit = opts.limit ? parseInt(opts.limit, 10) : 100
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch actors: ${error.message}`)
  }

  let actors = (data ?? []) as Record<string, unknown>[]

  // Top-N sorting after fetch (since we can't easily express rarity ordering in PostgREST)
  if (opts.top) {
    const rarityRank = { MYTHIC: 4, LEGENDARY: 3, EPIC: 2, RARE: 1 }
    actors = actors.sort((a, b) => {
      const rarityA = rarityRank[a.rarity as keyof typeof rarityRank] ?? 0
      const rarityB = rarityRank[b.rarity as keyof typeof rarityRank] ?? 0
      if (rarityA !== rarityB) return rarityB - rarityA
      return (b.threat_level as number) - (a.threat_level as number)
    }).slice(0, parseInt(opts.top, 10))
  }

  // Apply exclusions
  if (opts.exclude && opts.exclude.length > 0) {
    actors = actors.filter((a) => !opts.exclude!.includes(String(a.id)))
  }

  return actors
}

// ---------------------------------------------------------------------------
// Main entry point
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2)
  const { values } = parseArgs({
    args,
    options: {
      actor: { type: "string" },
      top: { type: "string" },
      limit: { type: "string" },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      provider: { type: "string" },
      exclude: { type: "string", multiple: true },
    },
    allowPositionals: true,
  })

  const opts: CliOptions = {
    actor: values.actor,
    top: values.top,
    limit: values.limit,
    force: values.force,
    dryRun: values["dry-run"],
    provider: values.provider,
    exclude: values.exclude,
  }

  // Select provider
  let provider: ImageProvider
  try {
    if (opts.provider) {
      const named = await getProviderByName(opts.provider)
      if (!named) {
        throw new Error(`Provider '${opts.provider}' not available or API key not set`)
      }
      provider = named
    } else {
      provider = await selectProvider()
    }
    console.log(`Using provider: ${provider.name}`)
  } catch (error) {
    console.error((error as Error).message)
    console.log("\nAvailable providers (set API key in environment):")
    console.log("  - Gemini Imagen 3 (GEMINI_API_KEY) - recommended")
    console.log("  - Hugging Face (HF_API_KEY)")
    console.log("  - Stable Horde (STABLE_HORDE_API_KEY)")
    console.log("  - OpenAI DALL-E (OPENAI_API_KEY)")
    process.exit(1)
  }

  // Fetch actors to process
  const actors = await fetchActors(opts)
  console.log(`Processing ${actors.length} actor(s)`)

  // Process each actor
  const results = {
    ok: 0,
    skipped: 0,
    failed: 0,
    "dry-run": 0,
  }

  for (const actor of actors) {
    const result = await processActor(actor, provider, opts)
    results[result.status]++
    if (result.error) {
      console.warn(`  ✗ ${actor.id}: ${result.error}`)
    }
  }

  // Summary
  console.log("\n--- Summary ---")
  for (const [status, count] of Object.entries(results)) {
    if (count > 0) {
      console.log(`${status}: ${count}`)
    }
  }

  if (results.failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
