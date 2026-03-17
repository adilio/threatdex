/**
 * AI hero image generation worker.
 *
 * Feature-flagged: skips gracefully if OPENAI_API_KEY is not set.
 * Uses OpenAI DALL-E 3 to generate card hero images for ThreatDex threat actors.
 *
 * Each actor gets a unique cyberpunk-style hero image derived from their
 * intelligence profile (country, sophistication, motivation, tools, etc.).
 *
 * Usage:
 *   OPENAI_API_KEY=<key> npx tsx workers/image-gen.ts [actor_id]
 *   OPENAI_API_KEY=<key> npx tsx workers/image-gen.ts   # processes all actors missing images
 */

import OpenAI from "openai"
import { supabase, logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY not set — skipping image generation")
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IMAGE_SIZE = "1024x1024" as const
const IMAGE_QUALITY = "standard" as const
const IMAGE_MODEL = "dall-e-3"

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const SOPHISTICATION_DESCRIPTORS: Record<string, string> = {
  "Nation-State Elite":
    "elite nation-state threat actor, cutting-edge cyber warfare capabilities",
  "Very High": "highly sophisticated advanced persistent threat",
  High: "sophisticated professional hacker group",
  Medium: "moderately skilled cybercriminal collective",
  Low: "script kiddie or low-skill threat actor",
}

const MOTIVATION_DESCRIPTORS: Record<string, string> = {
  espionage: "intelligence gathering and cyber espionage",
  financial: "financially motivated cybercrime and theft",
  sabotage: "destructive cyberattacks and sabotage",
  hacktivism: "ideologically motivated hacktivism",
  military: "military cyber operations and warfare",
}

const RARITY_STYLE: Record<string, string> = {
  MYTHIC:
    "legendary holographic foil card, bright yellow aura, " +
    "mythic-tier god-like power, chromatic rainbow shimmer",
  LEGENDARY:
    "legendary golden foil card, deep orange glow, " +
    "legendary aura, metallic sheen",
  EPIC:
    "epic purple holographic card, violet glow, " +
    "powerful epic-tier energy field",
  RARE:
    "rare blue holographic card, cool blue shimmer, " +
    "rare-tier energy aura",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildImagePrompt(actor: Record<string, any>): string {
  const name: string =
    (actor["canonical_name"] as string | undefined) ??
    (actor["id"] as string | undefined) ??
    "Unknown Actor"
  const country: string | undefined = actor["country"] as string | undefined
  const sophistication: string =
    (actor["sophistication"] as string | undefined) ?? "High"
  const motivation: string[] =
    (actor["motivation"] as string[] | undefined) ?? ["espionage"]
  const tools: string[] = (actor["tools"] as string[] | undefined) ?? []
  const rarity: string = (actor["rarity"] as string | undefined) ?? "RARE"

  const baseStyle =
    "cyberpunk trading card art, dark navy blue background (#00123F), " +
    "glowing circuit board patterns, neon accent lighting, " +
    "Wiz-style security aesthetic, dramatic lighting, high detail"

  const sophDesc =
    SOPHISTICATION_DESCRIPTORS[sophistication] ?? "skilled threat actor"

  const primaryMotivation = motivation[0] ?? "espionage"
  const motivDesc =
    MOTIVATION_DESCRIPTORS[primaryMotivation] ?? "cyber operations"

  const countryAesthetic = country
    ? `, ${country} cultural aesthetic elements, `
    : ""

  const toolDesc =
    tools.length > 0
      ? `associated with tools like ${tools.slice(0, 3).join(", ")}, `
      : ""

  const rarityStyle = RARITY_STYLE[rarity] ?? RARITY_STYLE["RARE"]

  const figureDesc =
    `shadowy hacker figure representing a ${sophDesc}, ` +
    `engaged in ${motivDesc}`

  return (
    `${baseStyle}. ` +
    `${figureDesc}${countryAesthetic}` +
    `${toolDesc}` +
    `${rarityStyle}. ` +
    `Card title area reserved at top reading '${name}'. ` +
    `Cinematic composition, portrait orientation, ultra-detailed, ` +
    `digital art, trending on artstation.`
  )
}

// ---------------------------------------------------------------------------
// Core generation function
// ---------------------------------------------------------------------------

export async function generateImageForActor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: Record<string, any>
): Promise<string | null> {
  const actorId: string = (actor["id"] as string | undefined) ?? "unknown"
  const prompt = buildImagePrompt(actor)

  console.log(
    `Generating image for actor ${actorId} (prompt: ${prompt.length} chars)`
  )

  try {
    const client = new OpenAI({ apiKey: OPENAI_API_KEY! })
    const response = await client.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      n: 1,
    })

    const imageUrl: string | undefined = response.data?.[0]?.url ?? undefined
    if (!imageUrl) {
      console.error(`OpenAI returned no image URL for actor ${actorId}`)
      return null
    }

    return imageUrl
  } catch (err) {
    console.error(`Image generation failed for actor ${actorId}:`, err)
    return null
  }
}

async function updateActorImageUrl(
  actorId: string,
  imageUrl: string
): Promise<void> {
  const { error } = await supabase
    .from("actors")
    .update({
      image_url: imageUrl,
      last_updated: new Date().toISOString(),
    })
    .eq("id", actorId)

  if (error) {
    console.warn(
      `Failed to update image_url for actor ${actorId}:`,
      error.message
    )
  } else {
    console.log(`Updated image_url for actor ${actorId}`)
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const targetActorId = process.argv[2] ?? null

  const logId = await logSyncStart("image-gen")
  let recordsSynced = 0

  try {
    let actors: Record<string, unknown>[]

    if (targetActorId) {
      // Single actor mode
      const { data, error } = await supabase
        .from("actors")
        .select("*")
        .eq("id", targetActorId)
        .single()

      if (error || !data) {
        throw new Error(`Actor '${targetActorId}' not found in database`)
      }
      actors = [data as Record<string, unknown>]
    } else {
      // Batch mode: process all actors without an image
      const { data, error } = await supabase
        .from("actors")
        .select("*")
        .is("image_url", null)

      if (error) {
        throw new Error(`Failed to fetch actors: ${error.message}`)
      }
      actors = (data ?? []) as Record<string, unknown>[]
      console.log(`Found ${actors.length} actors without images`)
    }

    for (const actor of actors) {
      const actorId = (actor["id"] as string | undefined) ?? "unknown"
      try {
        // Build and store the image prompt for reference
        const prompt = buildImagePrompt(actor)

        // Store the prompt before generating (so it persists even if gen fails)
        await supabase
          .from("actors")
          .update({ image_prompt: prompt })
          .eq("id", actorId)

        const imageUrl = await generateImageForActor(actor)
        if (imageUrl) {
          await updateActorImageUrl(actorId, imageUrl)
          recordsSynced++
        } else {
          console.warn(`Image generation skipped or failed for ${actorId}`)
        }
      } catch (e) {
        console.warn(`Failed to generate image for ${actorId} — skipping:`, e)
      }
    }

    await logSyncComplete(logId, recordsSynced)
    console.log(`Image generation complete — ${recordsSynced} actors updated`)
  } catch (e) {
    await logSyncError(logId, String(e))
    throw e
  }
}

main().catch(console.error)
