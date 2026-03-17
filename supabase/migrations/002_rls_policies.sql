-- Row Level Security policies for ThreatDex
-- Actors: public read access, service-role only writes
-- sync_log: service-role only

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Public read access to actors (anonymous and authenticated users)
CREATE POLICY "actors_read" ON actors
  FOR SELECT USING (true);

-- Only service role can insert actors
CREATE POLICY "actors_insert" ON actors
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update actors
CREATE POLICY "actors_update" ON actors
  FOR UPDATE USING (auth.role() = 'service_role');

-- Only service role can delete actors
CREATE POLICY "actors_delete" ON actors
  FOR DELETE USING (auth.role() = 'service_role');

-- Only service role can access sync_log
CREATE POLICY "sync_log_all" ON sync_log
  USING (auth.role() = 'service_role');
