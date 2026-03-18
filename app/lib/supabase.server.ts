import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

let client: ReturnType<typeof createClient> | null = null

export function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "ThreatDex is missing SUPABASE_URL or SUPABASE_SERVICE_KEY on the server."
    )
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  }

  return client
}
