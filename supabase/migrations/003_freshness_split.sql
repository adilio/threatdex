-- ThreatDex freshness split migration
-- Splits last_updated into intel_last_updated and media_last_updated
-- This allows tracking when intel was updated vs when media was refreshed

-- Add new columns (idempotent - use IF NOT EXISTS equivalent)
DO $$
BEGIN
  -- Add intel_last_updated if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actors' AND column_name = 'intel_last_updated'
  ) THEN
    ALTER TABLE actors ADD COLUMN intel_last_updated timestamptz;
  END IF;

  -- Add media_last_updated if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actors' AND column_name = 'media_last_updated'
  ) THEN
    ALTER TABLE actors ADD COLUMN media_last_updated timestamptz;
  END IF;
END $$;

-- Backfill: existing last_updated assumed to be intel
UPDATE actors
SET intel_last_updated = last_updated
WHERE intel_last_updated IS NULL;
