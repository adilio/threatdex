-- ThreatDex ranked actors RPC
-- Provides composite "interestingness" sort for better default ordering

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS list_actors_ranked;

-- Create function that returns actors ranked by composite score
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
  -- Get total count first
  SELECT COUNT(*)
  INTO v_total
  FROM actors a
  WHERE
    (p_country_code IS NULL OR a.country_code = p_country_code)
    AND (p_motivation IS NULL OR a.motivation @> p_motivation::jsonb)
    AND (p_rarity IS NULL OR a.rarity = p_rarity)
    AND (p_source IS NULL OR a.sources::text LIKE '%"source":"' || p_source || '"%')
    AND (NOT p_verified_only OR jsonb_array_length(a.sources) >= 2);

  -- Return ranked results
  RETURN QUERY
  SELECT
    a.*,
    v_total AS total_count
  FROM actors a
  WHERE
    (p_country_code IS NULL OR a.country_code = p_country_code)
    AND (p_motivation IS NULL OR a.motivation @> p_motivation::jsonb)
    AND (p_rarity IS NULL OR a.rarity = p_rarity)
    AND (p_source IS NULL OR a.sources::text LIKE '%"source":"' || p_source || '"%')
    AND (NOT p_verified_only OR jsonb_array_length(a.sources) >= 2)
  ORDER BY
    -- Rarity rank: MYTHIC=4, LEGENDARY=3, EPIC=2, RARE=1
    CASE a.rarity
      WHEN 'MYTHIC' THEN 4
      WHEN 'LEGENDARY' THEN 3
      WHEN 'EPIC' THEN 2
      ELSE 1
    END DESC,
    -- Threat level secondary
    a.threat_level DESC,
    -- Number of sources tertiary
    jsonb_array_length(a.sources) DESC,
    -- Has image quaternary
    CASE WHEN a.image_url IS NOT NULL THEN 1 ELSE 0 END DESC,
    -- Name tiebreaker
    a.canonical_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION list_actors_ranked TO service_role;
