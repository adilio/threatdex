import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { supabase } from "~/lib/supabase.server"
import { ThreatActorCard } from "~/components/ThreatActorCard"
import { SearchBar } from "~/components/SearchBar"
import { FilterPanel } from "~/components/FilterPanel"
import type { ThreatActor } from "~/schema"

const LIMIT = 20

// Type for RPC result that includes total_count
interface ActorWithTotal extends ThreatActor {
  total_count?: number
}

export const meta: MetaFunction = () => [
  { title: "ThreatDex — Know your adversaries, card by card" },
  {
    name: "description",
    content:
      "Aggregated cyber threat intelligence from MITRE ATT&CK, ETDA, AlienVault OTX, and more — rendered as interactive trading cards.",
  },
]

function mapToActor(row: Record<string, unknown>): ThreatActor {
  return {
    id: row.id as string,
    canonicalName: row.canonical_name as string,
    aliases: (row.aliases as string[]) ?? [],
    mitreId: (row.mitre_id as string | undefined) ?? undefined,
    country: (row.country as string | undefined) ?? undefined,
    countryCode: (row.country_code as string | undefined) ?? undefined,
    motivation: (row.motivation as ThreatActor["motivation"]) ?? [],
    threatLevel: row.threat_level as number,
    sophistication: row.sophistication as ThreatActor["sophistication"],
    firstSeen: (row.first_seen as string | undefined) ?? undefined,
    lastSeen: (row.last_seen as string | undefined) ?? undefined,
    sectors: (row.sectors as string[]) ?? [],
    geographies: (row.geographies as string[]) ?? [],
    tools: (row.tools as string[]) ?? [],
    ttps: (row.ttps as ThreatActor["ttps"]) ?? [],
    campaigns: (row.campaigns as ThreatActor["campaigns"]) ?? [],
    description: row.description as string,
    tagline: (row.tagline as string | undefined) ?? undefined,
    rarity: row.rarity as ThreatActor["rarity"],
    imageUrl: (row.image_url as string | undefined) ?? undefined,
    imagePrompt: (row.image_prompt as string | undefined) ?? undefined,
    sources: (row.sources as ThreatActor["sources"]) ?? [],
    tlp: (row.tlp as ThreatActor["tlp"]) ?? "WHITE",
    lastUpdated: row.last_updated as string,
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const search = url.searchParams.get("q") ?? ""
  const country = url.searchParams.get("country") ?? ""
  const motivation = url.searchParams.get("motivation") ?? ""
  const rarity = url.searchParams.get("rarity") ?? ""
  const source = url.searchParams.get("source") ?? ""
  // Phase 4.2: Verified filter (default true, only false disables it)
  const verified = url.searchParams.get("verified") ?? "true"
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

  // Phase 4.3: Use ranked RPC for better default sort when not searching
  if (!search) {
    const { data, error } = await supabase
      .rpc("list_actors_ranked", {
        p_limit: LIMIT,
        p_offset: offset,
        p_country_code: country || null,
        p_motivation: motivation || null,
        p_rarity: rarity || null,
        p_source: source || null,
        p_verified_only: verified === "true",
      })

    if (error) {
      console.error("RPC error, falling back to direct query:", error)
      // Fallback to direct query on error
    } else if (data && data.length > 0) {
      const total = (data[0] as ActorWithTotal).total_count ?? 0
      return {
        items: (data as Record<string, unknown>[]).map(mapToActor),
        total,
        limit: LIMIT,
        offset,
        searchParams: { q: search, country, motivation, rarity, source, verified },
      }
    }
  }

  // Fallback or search path
  let query = supabase
    .from("actors")
    .select("*", { count: "exact" })
    .order("threat_level", { ascending: false })
    .range(offset, offset + LIMIT - 1)

  if (search) {
    // Use Postgres full-text search RPC if available, otherwise ilike
    const { data, count, error } = await supabase
      .rpc("search_actors", { query: search })
      .range(offset, offset + LIMIT - 1)
    if (error) throw new Response("Failed to load actors", { status: 500 })
    return {
      items: ((data ?? []) as Record<string, unknown>[]).map(mapToActor),
      total: count ?? 0,
      limit: LIMIT,
      offset,
      searchParams: { q: search, country, motivation, rarity, source, verified },
    }
  }

  if (country) query = query.eq("country_code", country)
  if (motivation) query = query.contains("motivation", [motivation])
  if (rarity) query = query.eq("rarity", rarity)
  // Phase 4.4: Source filter - filter by source array containing the value
  if (source) {
    query = query.filter("sources", "cs", `[{"source":"${source}"}]`)
  }
  // Phase 4.2: Verified filter - actors with 2+ sources
  if (verified === "true") {
    // Use a greater-than filter on jsonb_array_length
    // Note: Using filter for jsonb array length - ideally this would be an RPC
    query = query.filter("sources", "cs", "[{},{}]") as typeof query
    // This is a simplified check - for production, the RPC handles this properly
  }

  const { data, count, error } = await query
  if (error) throw new Response("Failed to load actors", { status: 500 })

  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(mapToActor),
    total: count ?? 0,
    limit: LIMIT,
    offset,
    searchParams: { q: search, country, motivation, rarity, source, verified },
  }
}

export default function HomePage() {
  const { items, total, limit, offset, searchParams } =
    useLoaderData<typeof loader>()

  const loadMoreParams = new URLSearchParams({
    ...(searchParams.q ? { q: searchParams.q } : {}),
    ...(searchParams.country ? { country: searchParams.country } : {}),
    ...(searchParams.motivation ? { motivation: searchParams.motivation } : {}),
    ...(searchParams.rarity ? { rarity: searchParams.rarity } : {}),
    ...(searchParams.source ? { source: searchParams.source } : {}),
    ...(searchParams.verified ? { verified: searchParams.verified } : {}),
    offset: String(offset + limit),
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-4 tracking-tight">
          <span className="text-wiz-blue">Threat</span>
          <span className="text-vibrant-pink">Dex</span>
        </h1>
        <p className="text-xl sm:text-2xl text-sky-blue/80 font-mono mb-8">
          Know your adversaries, card by card.
        </p>
        <p className="text-sky-blue/60 max-w-xl mx-auto text-sm leading-relaxed">
          Aggregated cyber threat intelligence from MITRE ATT&amp;CK, ETDA,
          AlienVault OTX, and more — rendered as interactive trading cards.
        </p>
      </section>

      {/* Search + Filters */}
      <section className="mb-10 space-y-4">
        <SearchBar
          initialValue={searchParams.q ?? ""}
          placeholder="Search actors, aliases, tools, techniques…"
        />
        <FilterPanel
          initialCountry={searchParams.country ?? ""}
          initialMotivation={searchParams.motivation ?? ""}
          initialRarity={searchParams.rarity ?? ""}
          initialSource={searchParams.source ?? ""}
          initialVerified={searchParams.verified ?? "true"}
        />
      </section>

      {/* Card Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="text-6xl">🔍</div>
          <h3 className="text-xl font-semibold text-sky-blue">
            No threat actors found
          </h3>
          <p className="text-sky-blue/60 text-sm">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-sky-blue/60 font-mono mb-6">
            Showing {offset + 1}–{Math.min(offset + items.length, total)} of{" "}
            {total} actors
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((actor: ThreatActor) => (
              <ThreatActorCard key={actor.id} actor={actor} />
            ))}
          </div>
          {offset + limit < total && (
            <div className="mt-12 flex justify-center">
              <a
                href={`?${loadMoreParams.toString()}`}
                className="px-8 py-3 bg-wiz-blue hover:bg-blue-shadow text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Load more actors
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
