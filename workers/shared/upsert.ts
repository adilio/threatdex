/**
 * Shared upsert logic that preserves media fields during same-ID merges.
 *
 * The bug: When existingId === actor.id (same slug from same source two nights in a row),
 * the merge is skipped and toDbRecord(actor) upserts with null for any field the new
 * parse didn't populate. This causes curated images and other accumulated data to be lost.
 *
 * This helper ensures that:
 * 1. Existing media fields (image_url, image_prompt, image_curated, etc.) are preserved
 * 2. Existing sources are merged (not replaced)
 * 3. Existing TTPs and campaigns are accumulated
 * 4. The merge happens even when existingId === actor.id
 */

import { getSupabase } from "./supabase.js"
import { findMatchingActor, mergeActors } from "./dedup.js"
import { toDbRecord, type ThreatActorData } from "./models.js"

export interface UpsertResult {
  id: string
  merged: boolean
  error: string | null
}

/**
 * Upsert an actor while preserving media and accumulated data.
 *
 * This function:
 * 1. Finds any existing matching actor (by alias or normalized name)
 * 2. If found, merges the incoming data with existing (preserving media)
 * 3. Upserts the merged result to the database
 *
 * After migration 003, intel_last_updated is set on every sync.
 * media_last_updated is only set by the image generation worker (Phase 3).
 *
 * @param incoming - The new actor data to upsert
 * @returns Result with actor ID, whether merge occurred, and any error
 */
export async function upsertActorPreservingMedia(
  incoming: ThreatActorData
): Promise<UpsertResult> {
  const supabase = getSupabase()
  const existingId = (await findMatchingActor(incoming)) ?? incoming.id

  // Always fetch existing row to preserve media, even if same ID
  const { data: existingRow } = await supabase
    .from("actors")
    .select("*")
    .eq("id", existingId)
    .maybeSingle()

  let actor = incoming
  let preserveImageCurated = false
  let preserveMediaLastUpdated = false

  if (existingRow) {
    // Check if existing row has image_curated=true (Phase 3+)
    if ((existingRow as Record<string, unknown>).image_curated === true) {
      preserveImageCurated = true
    }

    // Preserve existing media_last_updated if it exists
    if ((existingRow as Record<string, unknown>).media_last_updated) {
      preserveMediaLastUpdated = true
    }

    // Merge preserves: image_url, image_prompt, sources[], ttps[], campaigns[]
    actor = mergeActors(existingRow as Record<string, unknown>, incoming)
    actor.id = existingRow.id as string
  }

  const dbRecord = toDbRecord(actor)

  // Preserve image_curated flag if it was set
  if (preserveImageCurated) {
    (dbRecord as Record<string, unknown>).image_curated = true
  }

  // Preserve media_last_updated if it existed (don't overwrite with intel update)
  if (preserveMediaLastUpdated) {
    (dbRecord as Record<string, unknown>).media_last_updated =
      (existingRow as Record<string, unknown>).media_last_updated
  }

  const { error } = await supabase
    .from("actors")
    .upsert(dbRecord, { onConflict: "id" })

  return {
    id: actor.id,
    merged: !!existingRow,
    error: error?.message ?? null,
  }
}
