import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData, Link } from "react-router"
import { supabase } from "~/lib/supabase.server"
import { mapToActor } from "~/lib/actor-mapper"
import { ThreatActorCard } from "~/components/ThreatActorCard"
import { getRarityColor } from "~/schema"
import type { ThreatActor } from "~/schema"

export async function loader({ params }: LoaderFunctionArgs) {
  const { data, error } = await supabase
    .from("actors")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !data) {
    throw new Response("Not Found", { status: 404 })
  }

  return mapToActor(data as Record<string, unknown>)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Actor Not Found — ThreatDex" }]
  return [
    { title: `${data.canonicalName} — ThreatDex` },
    { name: "description", content: data.tagline ?? data.description.slice(0, 160) },
    { property: "og:title", content: `${data.canonicalName} — ThreatDex` },
    { property: "og:description", content: data.description.slice(0, 200) },
    ...(data.imageUrl ? [{ property: "og:image", content: data.imageUrl }] : []),
  ]
}

function TTPSection({ ttps }: { ttps: ThreatActor["ttps"] }) {
  if (ttps.length === 0) return null
  const byTactic = ttps.reduce<Record<string, typeof ttps>>((acc, ttp) => {
    if (!acc[ttp.tactic]) acc[ttp.tactic] = []
    acc[ttp.tactic].push(ttp)
    return acc
  }, {})
  return (
    <section className="mt-10">
      <h2 className="font-bold text-wiz-blue mb-4 uppercase tracking-widest text-sm">TTPs — MITRE ATT&CK</h2>
      <div className="space-y-4">
        {Object.entries(byTactic).map(([tactic, entries]) => (
          <div key={tactic} className="bg-blue-shadow/20 border border-blue-shadow/40 rounded-lg p-4">
            <h3 className="text-sky-blue font-semibold text-sm uppercase tracking-wider mb-3">{tactic}</h3>
            <div className="flex flex-wrap gap-2">
              {entries.map((ttp, idx) => (
                <a
                  key={ttp.techniqueId || `ttp-${idx}`}
                  href={ttp.techniqueId ? `https://attack.mitre.org/techniques/${ttp.techniqueId.replace(".", "/")}/` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-serious-blue border border-sky-blue/30 rounded text-xs font-mono text-sky-blue hover:border-sky-blue hover:text-cloudy-white transition-colors"
                  style={!ttp.techniqueId ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                >
                  <span className="text-light-sky-blue">{ttp.techniqueId || "N/A"}</span>
                  <span className="text-cloudy-white/60">{ttp.techniqueName || "Unknown"}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Phase 4.6: Improved campaign timeline sorted by year
function CampaignsSection({ campaigns }: { campaigns: ThreatActor["campaigns"] }) {
  if (campaigns.length === 0) return null

  // Sort campaigns by year descending, then by name
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const yearA = a.year ?? "9999"
    const yearB = b.year ?? "9999"
    if (yearA !== yearB) return yearB.localeCompare(yearA)
    return a.name.localeCompare(b.name)
  })

  // Group by decade for visual structure
  const byDecade: Record<string, typeof sortedCampaigns> = {}
  for (const campaign of sortedCampaigns) {
    const year = campaign.year ?? "Unknown"
    const decade = year === "Unknown" ? "Unknown" : `${year.slice(0, 3)}0s`
    if (!byDecade[decade]) byDecade[decade] = []
    byDecade[decade].push(campaign)
  }

  return (
    <section className="mt-10">
      <h2 className="font-bold text-wiz-blue mb-6 uppercase tracking-widest text-sm flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Campaign Timeline
      </h2>

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-wiz-blue via-blue-shadow to-sky-blue/30" />

        <div className="space-y-6">
          {Object.entries(byDecade).map(([decade, decadeCampaigns]) => (
            <div key={decade} className="relative">
              {/* Decade marker */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full bg-wiz-blue shadow-[0_0_8px_#0254EC66] z-10" />
                <span className="text-xs font-mono font-bold text-sky-blue uppercase tracking-wider">
                  {decade}
                </span>
                <div className="flex-1 h-px bg-blue-shadow/30" />
              </div>

              {/* Campaigns in this decade */}
              <div className="ml-8 space-y-3">
                {decadeCampaigns.map((campaign, idx) => (
                  <div
                    key={idx}
                    className="group relative bg-blue-shadow/10 border border-blue-shadow/30 hover:border-wiz-blue/50 rounded-lg p-4 transition-all"
                  >
                    <div className="absolute -left-[33px] top-4 w-2 h-2 rounded-full bg-sky-blue/50 group-hover:bg-wiz-blue transition-colors" />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-cloudy-white group-hover:text-sky-blue transition-colors">
                        {campaign.name}
                      </h3>
                      {campaign.year && (
                        <span className="text-xs font-mono text-sky-blue/60 bg-serious-blue px-2 py-0.5 rounded">
                          {campaign.year}
                        </span>
                      )}
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-sky-blue/70 leading-relaxed">{campaign.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ToolsSection({ tools }: { tools: string[] }) {
  if (tools.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="font-bold text-wiz-blue mb-4 uppercase tracking-widest text-sm">Tools &amp; Malware</h2>
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => (
          <span key={tool} className="px-3 py-1.5 bg-blue-shadow/30 border border-blue-shadow text-sky-blue text-sm font-mono rounded hover:bg-blue-shadow/50 transition-colors">
            {tool}
          </span>
        ))}
      </div>
    </section>
  )
}

function SourcesSection({ sources }: { sources: ThreatActor["sources"] }) {
  if (sources.length === 0) return null
  const sourceLabels: Record<string, string> = {
    mitre: "MITRE ATT&CK", etda: "ETDA", otx: "AlienVault OTX",
    misp: "MISP", opencti: "OpenCTI", manual: "Manual",
  }
  return (
    <section className="mt-10">
      <h2 className="font-bold text-wiz-blue mb-4 uppercase tracking-widest text-sm">Sources</h2>
      <div className="space-y-2">
        {sources.map((src, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b border-blue-shadow/30">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-cloudy-white">{sourceLabels[src.source] ?? src.source}</span>
              {src.sourceId && <span className="text-xs font-mono text-sky-blue/60">{src.sourceId}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-sky-blue/40">{new Date(src.fetchedAt).toLocaleDateString()}</span>
              {src.url && (
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-blue hover:text-wiz-blue transition-colors underline">
                  View source
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ActorPage() {
  const actor = useLoaderData<typeof loader>()
  const rarityColor = getRarityColor(actor.rarity)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-sky-blue hover:text-wiz-blue transition-colors mb-8 group">
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to all actors
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-12">
        <div className="flex flex-col items-center gap-6">
          <ThreatActorCard actor={actor} />
          <div
            className="px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase font-mono"
            style={{ borderColor: rarityColor, color: rarityColor, boxShadow: `0 0 8px 1px ${rarityColor}66` }}
          >
            {actor.rarity}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-cloudy-white mb-2">{actor.canonicalName}</h1>
            {actor.mitreId && (
              <a href={`https://attack.mitre.org/groups/${actor.mitreId}/`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-mono text-wiz-blue hover:text-sky-blue transition-colors">
                {actor.mitreId} ↗
              </a>
            )}
            {actor.tagline && <p className="text-sky-blue/80 italic mt-2 text-sm">&quot;{actor.tagline}&quot;</p>}
          </div>

          {actor.aliases.length > 0 && (
            <div className="mb-5">
              <span className="text-xs uppercase tracking-widest text-sky-blue/50 font-semibold mr-2">Also known as</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {actor.aliases.map((alias) => (
                  <span key={alias} className="px-2 py-0.5 bg-blue-shadow/20 text-sky-blue text-xs font-mono rounded border border-blue-shadow/30">{alias}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {actor.country && (
              <div className="bg-blue-shadow/20 rounded-lg p-3 border border-blue-shadow/30">
                <div className="text-xs uppercase tracking-widest text-sky-blue/50 mb-1">Origin</div>
                <div className="font-semibold text-cloudy-white text-sm flex items-center gap-1.5">
                  {actor.countryCode && <span className="font-mono text-xs text-sky-blue/60">[{actor.countryCode}]</span>}
                  {actor.country}
                </div>
              </div>
            )}
            <div className="bg-blue-shadow/20 rounded-lg p-3 border border-blue-shadow/30">
              <div className="text-xs uppercase tracking-widest text-sky-blue/50 mb-1">Threat Level</div>
              <div className="font-bold text-2xl font-mono" style={{ color: rarityColor }}>
                {actor.threatLevel}<span className="text-xs text-sky-blue/40 ml-1">/10</span>
              </div>
            </div>
            <div className="bg-blue-shadow/20 rounded-lg p-3 border border-blue-shadow/30">
              <div className="text-xs uppercase tracking-widest text-sky-blue/50 mb-1">Sophistication</div>
              <div className="font-semibold text-cloudy-white text-sm">{actor.sophistication}</div>
            </div>
            {actor.firstSeen && (
              <div className="bg-blue-shadow/20 rounded-lg p-3 border border-blue-shadow/30">
                <div className="text-xs uppercase tracking-widest text-sky-blue/50 mb-1">Active Since</div>
                <div className="font-mono text-cloudy-white text-sm">{actor.firstSeen}{actor.lastSeen && ` – ${actor.lastSeen}`}</div>
              </div>
            )}
            <div className="bg-blue-shadow/20 rounded-lg p-3 border border-blue-shadow/30">
              <div className="text-xs uppercase tracking-widest text-sky-blue/50 mb-1">TLP</div>
              <div className={`font-mono font-bold text-sm ${actor.tlp === "GREEN" ? "text-green-400" : "text-cloudy-white"}`}>TLP:{actor.tlp}</div>
            </div>
          </div>

          <div className="mb-5">
            <span className="text-xs uppercase tracking-widest text-sky-blue/50 font-semibold">Motivation</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {actor.motivation.map((m) => (
                <span key={m} className="px-2.5 py-1 bg-wiz-blue/20 border border-wiz-blue/40 text-wiz-blue text-xs font-semibold rounded uppercase tracking-wide">{m}</span>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <span className="text-xs uppercase tracking-widest text-sky-blue/50 font-semibold block mb-2">Overview</span>
            <p className="text-sky-blue/80 leading-relaxed text-sm">{actor.description}</p>
          </div>

          {actor.sectors.length > 0 && (
            <div className="mb-5">
              <span className="text-xs uppercase tracking-widest text-sky-blue/50 font-semibold block mb-2">Target Sectors</span>
              <div className="flex flex-wrap gap-1.5">
                {actor.sectors.map((s) => (
                  <span key={s} className="px-2.5 py-1 bg-frosting-pink/10 border border-frosting-pink/20 text-frosting-pink text-xs rounded">{s}</span>
                ))}
              </div>
            </div>
          )}

          {actor.geographies.length > 0 && (
            <div className="mb-5">
              <span className="text-xs uppercase tracking-widest text-sky-blue/50 font-semibold block mb-2">Target Regions</span>
              <div className="flex flex-wrap gap-1.5">
                {actor.geographies.map((g) => (
                  <span key={g} className="px-2.5 py-1 bg-light-sky-blue/10 border border-light-sky-blue/20 text-light-sky-blue text-xs rounded">{g}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-blue-shadow/40 pt-8">
        <TTPSection ttps={actor.ttps} />
        <CampaignsSection campaigns={actor.campaigns} />
        <ToolsSection tools={actor.tools} />
        <SourcesSection sources={actor.sources} />
      </div>

      <div className="mt-10 text-xs font-mono text-sky-blue/30 text-right">
        Last updated: {new Date(actor.lastUpdated).toLocaleString()}
      </div>
    </div>
  )
}
