-- ThreatDex image metadata migration
-- Adds fields for tracking generated images and curated protection

-- Add new image metadata columns
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS image_curated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS image_provider TEXT,
  ADD COLUMN IF NOT EXISTS image_generated_at TIMESTAMPTZ;

-- Set SANDWORM as curated (it has a manually curated image)
UPDATE actors
SET image_curated = true
WHERE id = 'sandworm';

-- Index for finding actors without images
CREATE INDEX IF NOT EXISTS actors_image_url_null_idx
  ON actors (image_url) WHERE image_url IS NULL;

-- Index for image freshness queries
CREATE INDEX IF NOT EXISTS actors_image_generated_at_idx
  ON actors (image_generated_at DESC) WHERE image_generated_at IS NOT NULL;
