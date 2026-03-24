/**
 * AI hero image generation worker.
 *
 * Uses Stable Horde (https://stablehorde.net) — a volunteer-powered, free image
 * generation network. No API key required; set STABLE_HORDE_API_KEY in .env for
 * higher priority (free to register at stablehorde.net).
 *
 * Each actor gets a unique cyberpunk-style hero image derived from their
 * intelligence profile (country, sophistication, motivation, tools, etc.).
 *
 * Usage:
 *   npx tsx workers/image-gen.ts [actor_id]
 *   npx tsx workers/image-gen.ts   # processes all actors missing images
 */

import { supabase, logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HORDE_API_URL = "https://stablehorde.net/api/v2"
// Anonymous key works for 512×512 images; register at stablehorde.net for priority
const HORDE_API_KEY = process.env.STABLE_HORDE_API_KEY ?? "0000000000"
const STORAGE_BUCKET = "actor-images"

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

// Maps words found in names/aliases to a visual creature or entity concept
const VISUAL_CONCEPTS: Record<string, string> = {
  bear: "a massive cybernetic bear with glowing circuit-board fur",
  wolf: "a sleek cybernetic wolf with neon-lit eyes",
  fox: "a cunning cybernetic fox wreathed in digital flames",
  snake: "a coiling cybernetic snake made of fiber optic cables",
  viper: "a venomous cybernetic viper dripping neon toxin",
  cobra: "a hooded cybernetic cobra with a glowing crest",
  panda: "a cybernetic giant panda with glowing markings",
  tiger: "a cybernetic tiger crackling with electric energy",
  dragon: "a vast cybernetic dragon exhaling streams of binary code",
  dragonfly: "a giant cybernetic dragonfly with iridescent wings",
  cat: "a sleek cybernetic cat with holographic eyes",
  kitten: "a small but menacing cybernetic kitten with oversized neon claws",
  ant: "a giant cybernetic ant with mandibles made of circuit boards",
  moth: "a cybernetic moth with luminous wing patterns made of data",
  worm: "a massive segmented worm made of interlocking circuit boards",
  spider: "a multi-eyed cybernetic spider spinning webs of data",
  hawk: "a razor-winged cybernetic hawk diving through digital clouds",
  eagle: "a cybernetic eagle with wings made of satellite dishes",
  falcon: "a cybernetic falcon with laser-sight eyes",
  rhino: "an armoured cybernetic rhinoceros with a glowing horn",
  typhoon: "a swirling typhoon entity made of data and lightning",
  storm: "a living storm entity crackling with digital electricity",
  thunder: "a towering being forged from digital thunder and lightning",
  volt: "a creature crackling with electric neon energy",
  lightning: "a being made of pure digital lightning",
  hurricane: "a roaring hurricane entity made of swirling code",
  tornado: "a tornado entity of spinning code and broken data",
  fire: "a flaming digital entity wreathed in neon fire",
  frost: "an ice-covered digital entity radiating cold blue light",
  shadow: "a shadow entity with no face, made of pure darkness and code",
  ghost: "a translucent ghost entity flickering with corrupted data",
  phantom: "a phantom entity phasing between dimensions of code",
  sandworm: "a colossal desert worm surfacing through a sea of circuit boards",
  lazarus: "a skeletal figure rising from digital ashes, wrapped in resurrection code",
  sphinx: "a cybernetic sphinx guarding encrypted secrets",
  titan: "a colossal titan entity made of stacked server racks",
  golem: "a stone golem whose body is carved from circuit boards",
  scorpion: "a cybernetic scorpion with a glowing stinger tail",
  hydra: "a multi-headed cybernetic hydra each head a different attack vector",
  leviathan: "a sea serpent leviathan made of submerged cables and dark water",
  mustang: "a wild cybernetic horse with a mane of electric sparks",
  kimsuky: "a spectral entity wearing a traditional mask with glowing eyes",
  turla: "a cybernetic snake coiled around a globe of data",
  gallium: "a liquid metal entity that morphs and flows like molten circuitry",
}

const RARITY_GLOW: Record<string, string> = {
  MYTHIC: "surrounded by a god-like chromatic rainbow aura, legendary holographic shimmer, bright yellow energy field",
  LEGENDARY: "surrounded by a golden metallic aura and deep orange glow",
  EPIC: "surrounded by a violet holographic energy field",
  RARE: "surrounded by a cool blue shimmer and neon glow",
}

const MOTIVATION_ENERGY: Record<string, string> = {
  espionage: "radiating a cold calculating blue light",
  financial: "surrounded by floating golden data coins",
  sabotage: "with destructive red energy crackling around it",
  hacktivism: "with chaotic multicolour energy",
  military: "with a sharp militaristic green energy field",
}

// Extract a visual concept by scanning all name/alias words against the keyword map
function extractVisualConcept(name: string, aliases: string[]): string {
  const allNames = [name, ...aliases].join(" ").toLowerCase()
  const words = allNames.split(/[\s\-_]+/)

  for (const word of words) {
    if (VISUAL_CONCEPTS[word]) return VISUAL_CONCEPTS[word]
  }
  // Also check multi-word keys
  for (const [key, concept] of Object.entries(VISUAL_CONCEPTS)) {
    if (allNames.includes(key)) return concept
  }
  // Fallback: use the actor name itself as the creature concept
  return `a menacing cyber entity known as ${name}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildImagePrompt(actor: Record<string, any>): string {
  const name: string =
    (actor["canonical_name"] as string | undefined) ??
    (actor["id"] as string | undefined) ??
    "Unknown Actor"
  const aliases: string[] = (actor["aliases"] as string[] | undefined) ?? []
  const country: string | undefined = actor["country"] as string | undefined
  const motivation: string[] = (actor["motivation"] as string[] | undefined) ?? ["espionage"]
  const rarity: string = (actor["rarity"] as string | undefined) ?? "RARE"

  const creature = extractVisualConcept(name, aliases)
  const rarityGlow = RARITY_GLOW[rarity] ?? RARITY_GLOW["RARE"]
  const energyDesc = MOTIVATION_ENERGY[motivation[0]] ?? MOTIVATION_ENERGY["espionage"]
  const countryAccent = country && country !== "Unknown"
    ? `, with the ${country} national flag colours and insignia incorporated into its armour or body,`
    : ""

  return (
    `Pokédex-style trading card creature illustration. ` +
    `${creature}, ${energyDesc}${countryAccent} ${rarityGlow}. ` +
    `Dark navy blue background with glowing circuit board patterns. ` +
    `Futuristic cyber-punk hacker aesthetic. ` +
    `Clean full-body character silhouette, vibrant neon colours, dramatic lighting, ` +
    `ultra-detailed digital art, trading card format.`
  )
}

// ---------------------------------------------------------------------------
// Core generation function
// ---------------------------------------------------------------------------

async function generateWithHorde(prompt: string): Promise<Buffer | null> {
  // Submit generation request
  const submitResp = await fetch(`${HORDE_API_URL}/generate/async`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": HORDE_API_KEY,
    },
    body: JSON.stringify({
      prompt,
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: "k_euler_a",
      },
      models: ["stable_diffusion"],
      r2: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!submitResp.ok) {
    const body = await submitResp.text()
    console.error(`Horde submission failed ${submitResp.status}: ${body}`)
    return null
  }

  const submit = (await submitResp.json()) as { id?: string; message?: string; warnings?: { message: string }[] }

  if (!submit.id) {
    console.error(`Horde did not return a job ID:`, submit.message ?? submit)
    return null
  }

  if (submit.warnings?.length) {
    console.log(`  Horde warnings: ${submit.warnings.map(w => w.message).join("; ")}`)
  }

  const jobId = submit.id
  const maxWait = 3 * 60 * 1000 // 3 minutes
  const pollInterval = 5_000
  const startTime = Date.now()

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval))

    const checkResp = await fetch(`${HORDE_API_URL}/generate/check/${jobId}`, {
      headers: { "apikey": HORDE_API_KEY },
      signal: AbortSignal.timeout(15_000),
    })

    if (!checkResp.ok) continue

    const check = (await checkResp.json()) as {
      done: boolean
      faulted: boolean
      wait_time: number
    }

    if (check.faulted) {
      console.error(`  Horde generation faulted for job ${jobId}`)
      return null
    }

    if (!check.done) {
      console.log(`  Waiting... ~${check.wait_time}s remaining`)
      continue
    }

    const resultResp = await fetch(`${HORDE_API_URL}/generate/status/${jobId}`, {
      headers: { "apikey": HORDE_API_KEY },
      signal: AbortSignal.timeout(30_000),
    })

    if (!resultResp.ok) {
      console.error(`  Failed to fetch result for job ${jobId}: ${resultResp.status}`)
      return null
    }

    const result = (await resultResp.json()) as {
      generations?: { img: string; censored?: boolean }[]
    }

    const b64 = result.generations?.[0]?.img
    if (!b64) {
      console.error(`  No image data in result for job ${jobId}`)
      return null
    }

    return Buffer.from(b64, "base64")
  }

  console.error(`  Horde generation timed out for job ${jobId}`)
  return null
}

export async function generateImageForActor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: Record<string, any>
): Promise<string | null> {
  const actorId: string = (actor["id"] as string | undefined) ?? "unknown"
  const prompt = buildImagePrompt(actor)

  console.log(`Generating image for actor ${actorId}`)

  try {
    const imageBuffer = await generateWithHorde(prompt)
    if (!imageBuffer) return null

    const filePath = `${actorId}.png`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, imageBuffer, { contentType: "image/png", upsert: true })

    if (uploadError) {
      console.error(`Storage upload failed for actor ${actorId}:`, uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
    return urlData.publicUrl
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
      // Batch mode: top 20 by threat level that are still missing an image
      const { data, error } = await supabase
        .from("actors")
        .select("*")
        .is("image_url", null)
        .order("threat_level", { ascending: false })
        .limit(20)

      if (error) {
        throw new Error(`Failed to fetch actors: ${error.message}`)
      }
      actors = (data ?? []) as Record<string, unknown>[]
      console.log(`Found ${actors.length} actors without images (top 20 by threat level)`)
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
