import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { getSupabaseServerClient } from "~/lib/supabase.server"
import { ThreatActorCard } from "~/components/ThreatActorCard"
import { SearchBar } from "~/components/SearchBar"
import { FilterPanel } from "~/components/FilterPanel"
import type { ThreatActor } from "~/schema"

const LIMIT = 20

type SortOption =
  | "threat_desc"
  | "recent_desc"
  | "updated_desc"
  | "name_asc"

const DATA_SOURCES = [
  {
    id: "mitre",
    name: "MITRE ATT&CK",
    blurb:
      "Canonical intrusion set mappings, ATT&CK techniques, and long-lived group identifiers.",
    href: "https://attack.mitre.org/groups/",
    cadence: "Nightly",
  },
  {
    id: "etda",
    name: "ETDA",
    blurb:
      "Regional APT profiles that enrich aliases, origin context, and operational notes.",
    href: "https://apt.etda.or.th/cgi-bin/aptgroups.cgi",
    cadence: "Nightly",
  },
  {
    id: "otx",
    name: "AlienVault OTX",
    blurb:
      "Pulse and campaign context for public reporting, indicators, and current reporting overlap.",
    href: "https://otx.alienvault.com/",
    cadence: "On demand",
  },
  {
    id: "art",
    name: "AI Portraits",
    blurb:
      "Optional generated hero art uses actor metadata and falls back to a themed dossier card when absent.",
    href: "https://platform.openai.com/docs/guides/image-generation",
    cadence: "Manual",
  },
] as const

export const meta: MetaFunction = () => [
  { title: "ThreatDex — Know your adversaries, card by card" },
  {
    name: "description",
    content:
      "Aggregated cyber threat intelligence from MITRE ATT&CK, ETDA, AlienVault OTX, and more — rendered as interactive trading cards.",
  },
]

function mapToActor(row: Record<string, unknown>): ThreatActor {
  const ttps = ((row.ttps as Record<string, unknown>[] | undefined) ?? []).map(
    (ttp) => ({
      techniqueId:
        (ttp.techniqueId as string | undefined) ??
        (ttp.technique_id as string | undefined) ??
        "",
      techniqueName:
        (ttp.techniqueName as string | undefined) ??
        (ttp.technique_name as string | undefined) ??
        "",
      tactic: (ttp.tactic as string | undefined) ?? "",
    }),
  )

  const sources = (
    (row.sources as Record<string, unknown>[] | undefined) ?? []
  ).map((source) => ({
    source: source.source as ThreatActor["sources"][number]["source"],
    sourceId:
      (source.sourceId as string | undefined) ??
      (source.source_id as string | undefined) ??
      undefined,
    fetchedAt:
      (source.fetchedAt as string | undefined) ??
      (source.fetched_at as string | undefined) ??
      new Date().toISOString(),
    url: (source.url as string | undefined) ?? undefined,
  }))

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
    ttps,
    campaigns: (row.campaigns as ThreatActor["campaigns"]) ?? [],
    description: row.description as string,
    tagline: (row.tagline as string | undefined) ?? undefined,
    rarity: row.rarity as ThreatActor["rarity"],
    imageUrl: (row.image_url as string | undefined) ?? undefined,
    imagePrompt: (row.image_prompt as string | undefined) ?? undefined,
    sources,
    tlp: (row.tlp as ThreatActor["tlp"]) ?? "WHITE",
    lastUpdated: row.last_updated as string,
  }
}

function sortActors(
  rows: Record<string, unknown>[],
  sort: SortOption,
) {
  const items = [...rows]

  items.sort((a, b) => {
    switch (sort) {
      case "name_asc":
        return String(a.canonical_name ?? "").localeCompare(
          String(b.canonical_name ?? ""),
        )
      case "updated_desc":
        return (
          new Date(String(b.last_updated ?? 0)).getTime() -
          new Date(String(a.last_updated ?? 0)).getTime()
        )
      case "recent_desc": {
        const lastSeenCompare = String(b.last_seen ?? "").localeCompare(
          String(a.last_seen ?? ""),
        )
        if (lastSeenCompare !== 0) return lastSeenCompare
        return (
          new Date(String(b.last_updated ?? 0)).getTime() -
          new Date(String(a.last_updated ?? 0)).getTime()
        )
      }
      case "threat_desc":
      default: {
        const threatDelta =
          Number(b.threat_level ?? 0) - Number(a.threat_level ?? 0)
        if (threatDelta !== 0) return threatDelta
        return String(a.canonical_name ?? "").localeCompare(
          String(b.canonical_name ?? ""),
        )
      }
    }
  })

  return items
}

export async function loader({ request }: LoaderFunctionArgs) {
  const supabase = getSupabaseServerClient()
  const url = new URL(request.url)
  const search = url.searchParams.get("q") ?? ""
  const country = url.searchParams.get("country") ?? ""
  const motivation = url.searchParams.get("motivation") ?? ""
  const rarity = url.searchParams.get("rarity") ?? ""
  const sort = (url.searchParams.get("sort") ?? "threat_desc") as SortOption
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

  let query = supabase.from("actors").select("*", { count: "exact" })

  switch (sort) {
    case "name_asc":
      query = query.order("canonical_name", { ascending: true })
      break
    case "updated_desc":
      query = query.order("last_updated", { ascending: false })
      break
    case "recent_desc":
      query = query
        .order("last_seen", { ascending: false, nullsFirst: false })
        .order("last_updated", { ascending: false })
      break
    case "threat_desc":
    default:
      query = query
        .order("threat_level", { ascending: false })
        .order("canonical_name", { ascending: true })
      break
  }

  query = query.range(offset, offset + LIMIT - 1)

  if (search) {
    const { data, error } = await (supabase as any)
      .rpc("search_actors", { query: search })

    if (error) throw new Response("Failed to load actors", { status: 500 })

    const sorted = sortActors((data ?? []) as Record<string, unknown>[], sort)
    const paged = sorted.slice(offset, offset + LIMIT)

    return {
      items: paged.map(mapToActor),
      total: sorted.length,
      limit: LIMIT,
      offset,
      searchParams: { q: search, country, motivation, rarity, sort },
    }
  }

  if (country) query = query.eq("country_code", country)
  if (motivation) query = query.contains("motivation", [motivation])
  if (rarity) query = query.eq("rarity", rarity)

  const { data, count, error } = await query
  if (error) throw new Response("Failed to load actors", { status: 500 })

  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(mapToActor),
    total: count ?? 0,
    limit: LIMIT,
    offset,
    searchParams: { q: search, country, motivation, rarity, sort },
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
    ...(searchParams.sort ? { sort: searchParams.sort } : {}),
    offset: String(offset + limit),
  })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="dex-panel relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
        <div className="dex-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="dex-kicker mb-4">Threat Actor Index</p>
            <h1 className="font-display text-5xl font-black uppercase tracking-[0.08em] sm:text-6xl lg:text-7xl">
              <span className="text-wiz-blue">Threat</span>
              <span className="text-pink-shadow">Dex</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-app-muted sm:text-lg">
              Threat intel with the feel of a collectible dossier. Browse actors,
              flip cards for context, and track which feeds are shaping the
              catalog.
            </p>
          </div>

          <div className="dex-subpanel space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="dex-kicker">Catalog Status</p>
                <p className="text-3xl font-black text-app-text">{total}</p>
                <p className="text-sm text-app-muted">actors loaded in this index</p>
              </div>
              <div className="rounded-2xl border border-wiz-blue/20 bg-wiz-blue/8 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-wiz-blue">
                  Mode
                </p>
                <p className="font-display text-lg font-bold uppercase tracking-[0.12em] text-app-text">
                  PokeDex
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-app-muted">
              Search and filters stay lightweight up top, while the cards focus
              on recognition first and deeper intel on flip.
            </p>
          </div>
        </div>
      </section>

      <section id="actors" className="scroll-mt-28 space-y-4">
        <SearchBar
          initialValue={searchParams.q ?? ""}
          placeholder="Search actors, aliases, tools, techniques…"
        />
        <FilterPanel
          initialCountry={searchParams.country ?? ""}
          initialMotivation={searchParams.motivation ?? ""}
          initialRarity={searchParams.rarity ?? ""}
          initialSort={searchParams.sort ?? "threat_desc"}
        />
      </section>

      {items.length === 0 ? (
        <div className="dex-panel flex flex-col items-center justify-center gap-6 py-24">
          <div className="text-6xl">🔍</div>
          <h3 className="text-xl font-semibold text-app-text">No threat actors found</h3>
          <p className="text-sm text-app-muted">Try adjusting your search or filters</p>
        </div>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="dex-kicker">
              Showing {offset + 1}–{Math.min(offset + items.length, total)} of{" "}
              {total} actors
            </p>
            <p className="text-sm text-app-muted">
              Click a card to open the expanded dossier. Flip inside the modal
              for the full front/back card without clipping.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {items.map((actor: ThreatActor) => (
              <div key={actor.id} className="flex justify-center">
                <ThreatActorCard actor={actor} />
              </div>
            ))}
          </div>
          {offset + limit < total && (
            <div className="flex justify-center pt-2">
              <a href={`?${loadMoreParams.toString()}`} className="dex-button">
                Load more actors
              </a>
            </div>
          )}
        </section>
      )}

      <section id="sources" className="scroll-mt-28 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="dex-kicker">Data Sources</p>
            <h2 className="font-display text-3xl font-black uppercase tracking-[0.08em] text-app-text">
              Feed Deck
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-app-muted">
            ThreatDex reads from public CTI sources and can optionally generate
            hero art per actor. The UI falls back gracefully when generated
            images do not exist yet.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {DATA_SOURCES.map((source) => (
            <a
              key={source.id}
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="dex-subpanel group flex min-h-48 flex-col justify-between transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-display text-xl font-bold uppercase tracking-[0.08em] text-app-text">
                    {source.name}
                  </p>
                  <span className="rounded-full border border-wiz-blue/20 bg-wiz-blue/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-wiz-blue">
                    {source.cadence}
                  </span>
                </div>
                <p className="text-sm leading-6 text-app-muted">{source.blurb}</p>
              </div>
              <p className="pt-4 text-sm font-semibold text-wiz-blue group-hover:text-pink-shadow">
                Open source reference
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
