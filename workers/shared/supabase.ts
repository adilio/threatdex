/**
 * Supabase client and sync logging helpers for ThreatDex workers.
 *
 * Replaces the Python shared/db.py module.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment"
  )
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
)

// ---------------------------------------------------------------------------
// Sync log helpers
// ---------------------------------------------------------------------------

/**
 * Insert a new sync_log row and return the generated log ID.
 */
export async function logSyncStart(source: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      source,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) {
    console.warn(`Failed to log sync start for ${source}:`, error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Mark a sync_log row as completed.
 */
export async function logSyncComplete(
  logId: string | null,
  recordsSynced: number
): Promise<void> {
  if (!logId) return
  const { error } = await supabase
    .from("sync_logs")
    .update({
      status: "complete",
      records_synced: recordsSynced,
      finished_at: new Date().toISOString(),
    })
    .eq("id", logId)

  if (error) {
    console.warn(`Failed to log sync complete (id=${logId}):`, error.message)
  }
}

/**
 * Mark a sync_log row as errored.
 */
export async function logSyncError(
  logId: string | null,
  errorMessage: string
): Promise<void> {
  if (!logId) return
  const { error } = await supabase
    .from("sync_logs")
    .update({
      status: "error",
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", logId)

  if (error) {
    console.warn(`Failed to log sync error (id=${logId}):`, error.message)
  }
}
