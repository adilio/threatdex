-- Fix list_actors_ranked return types for country_code CHAR(2).
-- The previous function declared country_code as TEXT while returning a.*
-- from actors, where country_code is CHAR(2), causing Postgres error 42804.

DROP FUNCTION IF EXISTS list_actors_ranked;

CREATE OR REPLACE FUNCTION list_actors_ranked(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_country_code TEXT DEFAULT NULL,
  p_motivation TEXT DEFAULT NULL,
  p_rarity TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_verified_only BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id TEXT,
  canonical_name TEXT,
  aliases JSONB,
  mitre_id TEXT,
  country TEXT,
  country_code TEXT,
  motivation JSONB,
  threat_level INTEGER,
  sophistication TEXT,
  first_seen TEXT,
  last_seen TEXT,
  sectors JSONB,
  geographies JSONB,
  tools JSONB,
  ttps JSONB,
  campaigns JSONB,
  description TEXT,
  tagline TEXT,
  rarity TEXT,
  image_url TEXT,
  image_prompt TEXT,
  image_curated BOOLEAN,
  image_storage_path TEXT,
  image_provider TEXT,
  image_generated_at TIMESTAMPTZ,
  intel_last_updated TIMESTAMPTZ,
  media_last_updated TIMESTAMPTZ,
  sources JSONB,
  tlp TEXT,
  last_updated TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_total
  FROM actors a
  WHERE
    (p_country_code IS NULL OR a.country_code::TEXT = p_country_code)
    AND (p_motivation IS NULL OR a.motivation @> p_motivation::jsonb)
    AND (p_rarity IS NULL OR a.rarity = p_rarity)
    AND (p_source IS NULL OR a.sources::text LIKE '%"source":"' || p_source || '"%')
    AND (NOT p_verified_only OR jsonb_array_length(a.sources) >= 2);

  RETURN QUERY
  SELECT
    a.id,
    a.canonical_name,
    a.aliases,
    a.mitre_id,
    a.country,
    a.country_code::TEXT AS country_code,
    a.motivation,
    a.threat_level,
    a.sophistication,
    a.first_seen,
    a.last_seen,
    a.sectors,
    a.geographies,
    a.tools,
    a.ttps,
    a.campaigns,
    a.description,
    a.tagline,
    a.rarity,
    a.image_url,
    a.image_prompt,
    a.image_curated,
    a.image_storage_path,
    a.image_provider,
    a.image_generated_at,
    a.intel_last_updated,
    a.media_last_updated,
    a.sources,
    a.tlp,
    a.last_updated,
    v_total AS total_count
  FROM actors a
  WHERE
    (p_country_code IS NULL OR a.country_code::TEXT = p_country_code)
    AND (p_motivation IS NULL OR a.motivation @> p_motivation::jsonb)
    AND (p_rarity IS NULL OR a.rarity = p_rarity)
    AND (p_source IS NULL OR a.sources::text LIKE '%"source":"' || p_source || '"%')
    AND (NOT p_verified_only OR jsonb_array_length(a.sources) >= 2)
  ORDER BY
    CASE a.rarity
      WHEN 'MYTHIC' THEN 4
      WHEN 'LEGENDARY' THEN 3
      WHEN 'EPIC' THEN 2
      ELSE 1
    END DESC,
    a.threat_level DESC,
    jsonb_array_length(a.sources) DESC,
    CASE WHEN a.image_url IS NOT NULL THEN 1 ELSE 0 END DESC,
    a.canonical_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION list_actors_ranked TO service_role;
