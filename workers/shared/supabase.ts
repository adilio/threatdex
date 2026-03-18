/**
 * Supabase client and sync logging helpers for ThreatDex workers.
 *
 * Replaces the Python shared/db.py module.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from the environment.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment"
    )
  }
  _supabase = createClient(url, key)
  return _supabase
}

/** @deprecated Use getSupabase() instead */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ---------------------------------------------------------------------------
// Sync log helpers
// ---------------------------------------------------------------------------

/**
 * Insert a new sync_log row and return the generated log ID.
 */
export async function logSyncStart(source: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("sync_log")
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
    .from("sync_log")
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
    .from("sync_log")
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
