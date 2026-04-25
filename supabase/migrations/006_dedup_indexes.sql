-- ThreatDex deduplication and performance indexes
-- Phase 5.1: Indexes for faster actor lookups and sync performance

-- Index for normalized name lookups (used by findMatchingActor)
CREATE INDEX IF NOT EXISTS actors_canonical_name_lower_idx
  ON actors (LOWER(canonical_name));

-- GIN index for JSONB array searches (aliases, tools, sources)
CREATE INDEX IF NOT EXISTS actors_aliases_gin_idx
  ON actors USING GIN (aliases);

CREATE INDEX IF NOT EXISTS actors_tools_gin_idx
  ON actors USING GIN (tools);

CREATE INDEX IF NOT EXISTS actors_sources_gin_idx
  ON actors USING GIN (sources);

CREATE INDEX IF NOT EXISTS actors_motivation_gin_idx
  ON actors USING GIN (motivation);

-- Index for sector and geography filters
CREATE INDEX IF NOT EXISTS actors_sectors_gin_idx
  ON actors USING GIN (sectors);

CREATE INDEX IF NOT EXISTS actors_geographies_gin_idx
  ON actors USING GIN (geographies);

-- Composite index for ranked queries (rarity + threat_level)
CREATE INDEX IF NOT EXISTS actors_rarity_threat_idx
  ON actors (rarity, threat_level DESC, jsonb_array_length(sources));

-- Index for image-related queries
CREATE INDEX IF NOT EXISTS actors_image_url_idx
  ON actors (image_url) WHERE image_url IS NOT NULL;

-- Index for freshness queries
CREATE INDEX IF NOT EXISTS actors_intel_last_updated_idx
  ON actors (intel_last_updated DESC);

CREATE INDEX IF NOT EXISTS actors_media_last_updated_idx
  ON actors (media_last_updated DESC);

-- Partial index for verified actors (2+ sources)
CREATE INDEX IF NOT EXISTS actors_verified_sources_idx
  ON actors (id) WHERE jsonb_array_length(sources) >= 2;

-- Comment documenting the purpose
COMMENT ON INDEX actors_canonical_name_lower_idx IS
  'Speeds up case-insensitive actor name lookups during deduplication';

COMMENT ON INDEX actors_aliases_gin_idx IS
  'Enables fast alias matching and overlap detection';

COMMENT ON INDEX actors_sources_gin_idx IS
  'Supports source filtering and verification status queries';

COMMENT ON INDEX actors_rarity_threat_idx IS
  'Optimizes the default ranking sort by rarity and threat level';
