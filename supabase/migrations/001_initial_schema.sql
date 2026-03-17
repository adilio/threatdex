-- ThreatDex initial schema
-- Creates actors and sync_log tables with full-text search support

-- Actors table
CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  aliases JSONB DEFAULT '[]'::jsonb,
  mitre_id TEXT,
  country TEXT,
  country_code CHAR(2),
  motivation JSONB DEFAULT '[]'::jsonb,
  threat_level INTEGER CHECK (threat_level BETWEEN 1 AND 10),
  sophistication TEXT,
  first_seen CHAR(4),
  last_seen CHAR(4),
  sectors JSONB DEFAULT '[]'::jsonb,
  geographies JSONB DEFAULT '[]'::jsonb,
  tools JSONB DEFAULT '[]'::jsonb,
  ttps JSONB DEFAULT '[]'::jsonb,
  campaigns JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  tagline TEXT,
  rarity TEXT CHECK (rarity IN ('MYTHIC', 'LEGENDARY', 'EPIC', 'RARE')),
  image_url TEXT,
  image_prompt TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  tlp TEXT CHECK (tlp IN ('WHITE', 'GREEN')) DEFAULT 'WHITE',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  search_vector TSVECTOR
);

-- Sync log table
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'complete', 'error')) DEFAULT 'running',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS actors_search_idx ON actors USING GIN (search_vector);

-- Additional indexes for common filters
CREATE INDEX IF NOT EXISTS actors_country_code_idx ON actors (country_code);
CREATE INDEX IF NOT EXISTS actors_rarity_idx ON actors (rarity);
CREATE INDEX IF NOT EXISTS actors_threat_level_idx ON actors (threat_level DESC);

-- Function to build the tsvector from actor fields
CREATE OR REPLACE FUNCTION actors_search_vector(
  p_canonical_name TEXT,
  p_aliases JSONB,
  p_tools JSONB,
  p_description TEXT
) RETURNS TSVECTOR AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(p_canonical_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(v, ' ') FROM jsonb_array_elements_text(p_aliases) v), ''
    )), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(v, ' ') FROM jsonb_array_elements_text(p_tools) v), ''
    )), 'C') ||
    setweight(to_tsvector('english', coalesce(p_description, '')), 'D');
$$ LANGUAGE sql IMMUTABLE;

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION actors_search_vector_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := actors_search_vector(
    NEW.canonical_name,
    NEW.aliases,
    NEW.tools,
    NEW.description
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS actors_search_vector_update ON actors;
CREATE TRIGGER actors_search_vector_update
  BEFORE INSERT OR UPDATE ON actors
  FOR EACH ROW
  EXECUTE FUNCTION actors_search_vector_trigger();

-- Full-text search function
CREATE OR REPLACE FUNCTION search_actors(query text)
RETURNS SETOF actors AS $$
  SELECT * FROM actors
  WHERE search_vector @@ plainto_tsquery('english', query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', query)) DESC;
$$ LANGUAGE sql STABLE;
