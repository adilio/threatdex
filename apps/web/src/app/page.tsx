import { Suspense } from "react";
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel } from "@/components/FilterPanel";
import { ActorCard } from "@/components/ActorCard";
import { CardSkeleton } from "@/components/CardSkeleton";
import { fetchActors } from "@/lib/api";
import type { ThreatActor } from "@/types";

interface HomePageProps {
  searchParams: {
    q?: string;
    country?: string;
    motivation?: string;
    rarity?: string;
    offset?: string;
  };
}

const LIMIT = 20;

async function ActorGrid({
  searchParams,
}: {
  searchParams: HomePageProps["searchParams"];
}) {
  const offset = parseInt(searchParams.offset ?? "0", 10);

  const data = await fetchActors({
    search: searchParams.q,
    country: searchParams.country,
    motivation: searchParams.motivation,
    rarity: searchParams.rarity,
    limit: LIMIT,
    offset,
  });

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="text-6xl">🔍</div>
        <h3 className="text-xl font-semibold text-sky-blue">
          No threat actors found
        </h3>
        <p className="text-sky-blue/60 text-sm">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-sky-blue/60 font-mono mb-6">
        Showing {offset + 1}–{Math.min(offset + data.items.length, data.total)}{" "}
        of {data.total} actors
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {data.items.map((actor: ThreatActor) => (
          <ActorCard key={actor.id} actor={actor} />
        ))}
      </div>
      {offset + LIMIT < data.total && (
        <div className="mt-12 flex justify-center">
          <a
            href={`?${new URLSearchParams({
              ...(searchParams.q ? { q: searchParams.q } : {}),
              ...(searchParams.country
                ? { country: searchParams.country }
                : {}),
              ...(searchParams.motivation
                ? { motivation: searchParams.motivation }
                : {}),
              ...(searchParams.rarity ? { rarity: searchParams.rarity } : {}),
              offset: String(offset + LIMIT),
            }).toString()}`}
            className="px-8 py-3 bg-wiz-blue hover:bg-blue-shadow text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Load more actors
          </a>
        </div>
      )}
    </div>
  );
}

function ActorGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function HomePage({ searchParams }: HomePageProps) {
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
        />
      </section>

      {/* Card Grid */}
      <Suspense fallback={<ActorGridSkeleton />}>
        <ActorGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
