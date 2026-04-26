import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { supabase } from "~/lib/supabase.server"
import { mapToActor } from "~/lib/actor-mapper"
import { ThreatActorCard } from "~/components/ThreatActorCard"
import { SearchBar } from "~/components/SearchBar"
import { FilterPanel } from "~/components/FilterPanel"
import { WizStar } from "~/components/WizStar"
import type { ThreatActor } from "~/schema"

const LIMIT = 20
type SortMode = "ranked" | "current"

// Type for RPC result that includes total_count
interface ActorWithTotal extends ThreatActor {
  total_count?: number
}

function sortMode(value: string | null): SortMode {
  return value === "current" ? "current" : "ranked"
}

function yearValue(value?: string): number {
  if (!value) return 0
  const year = Number.parseInt(value, 10)
  return Number.isFinite(year) ? year : 0
}

function currentActivityYear(actor: ThreatActor): number {
  const campaignYears = actor.campaigns.map((campaign) => yearValue(campaign.year))
  return Math.max(
    yearValue(actor.lastSeen),
    yearValue(actor.firstSeen),
    ...campaignYears,
  )
}

function sortByCurrentActivity(actors: ThreatActor[]): ThreatActor[] {
  return [...actors].sort((a, b) => {
    const activityDelta = currentActivityYear(b) - currentActivityYear(a)
    if (activityDelta !== 0) return activityDelta
    const intelDelta =
      new Date(b.intelLastUpdated ?? b.lastUpdated).getTime() -
      new Date(a.intelLastUpdated ?? a.lastUpdated).getTime()
    if (intelDelta !== 0) return intelDelta
    return b.threatLevel - a.threatLevel
  })
}

export const meta: MetaFunction = () => [
  { title: "ThreatDex — Know your adversaries, card by card" },
  {
    name: "description",
    content:
      "Aggregated cyber threat intelligence from MITRE ATT&CK, ETDA, AlienVault OTX, and more — rendered as interactive trading cards.",
  },
]

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const search = url.searchParams.get("q") ?? ""
  const country = url.searchParams.get("country") ?? ""
  const motivation = url.searchParams.get("motivation") ?? ""
  const rarity = url.searchParams.get("rarity") ?? ""
  const source = url.searchParams.get("source") ?? ""
  const verified = url.searchParams.get("verified") ?? "false"
  const sort = sortMode(url.searchParams.get("sort"))
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

  // Phase 4.3: Use ranked RPC for better default sort when not searching
  if (!search && sort === "ranked") {
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
        searchParams: { q: search, country, motivation, rarity, source, verified, sort },
      }
    }
  }

  // Fallback or search path
  let query = supabase
    .from("actors")
    .select("*", { count: "exact" })

  if (search) {
    // Use Postgres full-text search RPC if available, otherwise ilike
    const { data, count, error } = await supabase
      .rpc("search_actors", { query: search })
    if (error) throw new Response("Failed to load actors", { status: 500 })
    const actors = ((data ?? []) as Record<string, unknown>[]).map(mapToActor)
    const sortedActors =
      sort === "current" ? sortByCurrentActivity(actors) : actors
    return {
      items: sortedActors.slice(offset, offset + LIMIT),
      total: count ?? sortedActors.length,
      limit: LIMIT,
      offset,
      searchParams: { q: search, country, motivation, rarity, source, verified, sort },
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

  if (sort === "ranked") {
    query = query
      .order("threat_level", { ascending: false })
      .range(offset, offset + LIMIT - 1)
  }

  const { data, count, error } = await query
  if (error) throw new Response("Failed to load actors", { status: 500 })
  const actors = ((data ?? []) as Record<string, unknown>[]).map(mapToActor)
  const items =
    sort === "current"
      ? sortByCurrentActivity(actors).slice(offset, offset + LIMIT)
      : actors

  return {
    items,
    total: count ?? actors.length,
    limit: LIMIT,
    offset,
    searchParams: { q: search, country, motivation, rarity, source, verified, sort },
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
    ...(searchParams.sort && searchParams.sort !== "ranked" ? { sort: searchParams.sort } : {}),
    offset: String(offset + limit),
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-4 tracking-tight">
          <span className="brand-threat">Threat</span>
          <span className="brand-dex">Dex</span>
        </h1>
        <p className="inline-flex items-center justify-center gap-2 text-xl sm:text-2xl text-sky-blue/80 font-mono mb-8">
          <WizStar size={14} className="text-purplish-pink" />
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
          initialVerified={searchParams.verified ?? "false"}
          initialSort={searchParams.sort ?? "ranked"}
        />
      </section>

      {/* Card Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <WizStar size={42} className="text-purplish-pink" />
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
                className="px-8 py-3 bg-wiz-blue hover:bg-blue-shadow text-white font-semibold rounded-full transition-colors duration-200"
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
