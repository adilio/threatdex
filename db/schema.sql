-- ThreatDex database schema, RLS policies, and seed data
-- Apply via Supabase Studio (SQL editor) or:
--   psql $DATABASE_URL -f db/schema.sql

-- ============================================================
-- Schema
-- ============================================================

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

CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'complete', 'error')) DEFAULT 'running',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS actors_search_idx ON actors USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS actors_country_code_idx ON actors (country_code);
CREATE INDEX IF NOT EXISTS actors_rarity_idx ON actors (rarity);
CREATE INDEX IF NOT EXISTS actors_threat_level_idx ON actors (threat_level DESC);

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

CREATE OR REPLACE FUNCTION search_actors(query text)
RETURNS SETOF actors AS $$
  SELECT * FROM actors
  WHERE search_vector @@ plainto_tsquery('english', query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', query)) DESC;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actors_read" ON actors
  FOR SELECT USING (true);

CREATE POLICY "actors_insert" ON actors
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "actors_update" ON actors
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "actors_delete" ON actors
  FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "sync_log_all" ON sync_log
  USING (auth.role() = 'service_role');

-- ============================================================
-- Seed data
-- ============================================================

INSERT INTO actors (
  id, canonical_name, aliases, mitre_id,
  country, country_code,
  motivation, threat_level, sophistication,
  first_seen, last_seen,
  sectors, geographies, tools, ttps, campaigns,
  description, tagline,
  rarity, sources, tlp, last_updated
) VALUES
(
  'apt28',
  'APT28',
  '["Fancy Bear","Sofacy","Pawn Storm","Sednit","STRONTIUM","Tsar Team"]',
  'G0007',
  'Russia', 'RU',
  '["espionage","military"]',
  10, 'Nation-State Elite',
  '2004', '2024',
  '["Government","Defense","Energy","Media","NGO"]',
  '["United States","Europe","Ukraine","NATO members"]',
  '["Mimikatz","X-Agent","Sofacy","Zebrocy","CHOPSTICK","GAMEFISH"]',
  '[
    {"techniqueId":"T1566","techniqueName":"Phishing","tactic":"Initial Access"},
    {"techniqueId":"T1078","techniqueName":"Valid Accounts","tactic":"Defense Evasion"},
    {"techniqueId":"T1003","techniqueName":"OS Credential Dumping","tactic":"Credential Access"},
    {"techniqueId":"T1071","techniqueName":"Application Layer Protocol","tactic":"Command and Control"}
  ]',
  '[
    {"name":"Operation Pawn Storm","year":"2014","description":"Targeted NATO governments, US defense contractors, and Ukrainian military."},
    {"name":"DNC Hack","year":"2016","description":"Breach of Democratic National Committee email servers ahead of US presidential election."},
    {"name":"Olympic Destroyer","year":"2018","description":"Disruptive attack on 2018 Winter Olympics IT infrastructure."}
  ]',
  'APT28 is a sophisticated Russian state-sponsored threat group attributed to GRU Unit 26165. Active since the mid-2000s, they conduct cyber espionage primarily targeting governments, militaries, and security organisations across NATO member states. Known for spear-phishing, credential theft, and custom implants.',
  'Russia''s military intelligence cyber arm — persistent, precise, and politically motivated.',
  'MYTHIC',
  '[{"source":"mitre","sourceId":"G0007","fetchedAt":"2024-01-01T00:00:00Z","url":"https://attack.mitre.org/groups/G0007/"}]',
  'WHITE',
  NOW()
),
(
  'apt29',
  'APT29',
  '["Cozy Bear","The Dukes","Midnight Blizzard","YTTRIUM","Dark Halo","Iron Hemlock"]',
  'G0016',
  'Russia', 'RU',
  '["espionage"]',
  9, 'Nation-State Elite',
  '2008', '2024',
  '["Government","Think Tanks","Healthcare","Technology","Finance"]',
  '["United States","Europe","NATO members"]',
  '["MiniDuke","CosmicDuke","OnionDuke","CloudDuke","HAMMERTOSS","Sliver"]',
  '[
    {"techniqueId":"T1195","techniqueName":"Supply Chain Compromise","tactic":"Initial Access"},
    {"techniqueId":"T1027","techniqueName":"Obfuscated Files or Information","tactic":"Defense Evasion"},
    {"techniqueId":"T1552","techniqueName":"Unsecured Credentials","tactic":"Credential Access"},
    {"techniqueId":"T1567","techniqueName":"Exfiltration Over Web Service","tactic":"Exfiltration"}
  ]',
  '[
    {"name":"SolarWinds (SUNBURST)","year":"2020","description":"Compromised SolarWinds Orion build pipeline, affecting 18,000+ organisations including US federal agencies."},
    {"name":"DNC Hack 2016","year":"2016","description":"Separate operation from APT28; focused on long-term access and exfiltration rather than disruption."},
    {"name":"Microsoft Executive Emails","year":"2024","description":"Breached Microsoft corporate email accounts including senior leadership."}
  ]',
  'APT29 is a Russian SVR-affiliated threat group renowned for extreme operational security, patient long-dwell intrusions, and high-profile supply chain attacks. The SolarWinds SUNBURST campaign demonstrated their ability to compromise global software supply chains at scale.',
  'Patient, precise, and nearly invisible — the SVR''s cyber elite.',
  'MYTHIC',
  '[{"source":"mitre","sourceId":"G0016","fetchedAt":"2024-01-01T00:00:00Z","url":"https://attack.mitre.org/groups/G0016/"}]',
  'WHITE',
  NOW()
),
(
  'lazarus-group',
  'Lazarus Group',
  '["HIDDEN COBRA","Guardians of Peace","ZINC","NICKEL ACADEMY","Dark Seoul"]',
  'G0032',
  'North Korea', 'KP',
  '["financial","espionage","sabotage"]',
  9, 'Nation-State Elite',
  '2009', '2024',
  '["Finance","Cryptocurrency","Defense","Media","Healthcare"]',
  '["South Korea","United States","Global cryptocurrency exchanges"]',
  '["BLINDINGCAN","HOPLIGHT","ARTFULPIE","Manuscrypt","MATA","DTrack"]',
  '[
    {"techniqueId":"T1059","techniqueName":"Command and Scripting Interpreter","tactic":"Execution"},
    {"techniqueId":"T1486","techniqueName":"Data Encrypted for Impact","tactic":"Impact"},
    {"techniqueId":"T1566","techniqueName":"Phishing","tactic":"Initial Access"},
    {"techniqueId":"T1021","techniqueName":"Remote Services","tactic":"Lateral Movement"}
  ]',
  '[
    {"name":"Sony Pictures Hack","year":"2014","description":"Destructive attack on Sony Pictures Entertainment, exfiltrating terabytes of data and deploying wiper malware."},
    {"name":"WannaCry","year":"2017","description":"Global ransomworm affecting 200,000+ systems across 150 countries."},
    {"name":"Crypto Exchange Heists","year":"2022","description":"Estimated $1.7B in cryptocurrency stolen from DeFi platforms and exchanges."}
  ]',
  'Lazarus Group is North Korea''s primary cyber threat actor, operating under the Reconnaissance General Bureau. Uniquely, they conduct both financially motivated heists (funding the DPRK regime) and destructive espionage operations, making them one of the most versatile nation-state threats.',
  'North Korea''s cyber swiss army knife — espionage, destruction, and billion-dollar heists.',
  'LEGENDARY',
  '[{"source":"mitre","sourceId":"G0032","fetchedAt":"2024-01-01T00:00:00Z","url":"https://attack.mitre.org/groups/G0032/"}]',
  'WHITE',
  NOW()
),
(
  'apt41',
  'APT41',
  '["Double Dragon","Winnti Group","Barium","Wicked Panda","Earth Baku"]',
  'G0096',
  'China', 'CN',
  '["espionage","financial"]',
  9, 'Very High',
  '2012', '2024',
  '["Healthcare","Telecommunications","Technology","Video Games","Finance"]',
  '["United States","India","Taiwan","Japan","South Korea","Southeast Asia"]',
  '["PlugX","ShadowPad","Cobalt Strike","MESSAGETAP","POISONPLUG"]',
  '[
    {"techniqueId":"T1190","techniqueName":"Exploit Public-Facing Application","tactic":"Initial Access"},
    {"techniqueId":"T1505","techniqueName":"Server Software Component","tactic":"Persistence"},
    {"techniqueId":"T1074","techniqueName":"Data Staged","tactic":"Collection"},
    {"techniqueId":"T1048","techniqueName":"Exfiltration Over Alternative Protocol","tactic":"Exfiltration"}
  ]',
  '[
    {"name":"Video Game Supply Chain","year":"2019","description":"Compromised video game companies to steal in-game currency and conduct supply chain attacks."},
    {"name":"COVID-19 Research Targeting","year":"2020","description":"Targeted vaccine developers and healthcare organisations during the pandemic."},
    {"name":"US State Government Intrusions","year":"2021","description":"Breached networks of at least six US state governments via agriculture and animal welfare systems."}
  ]',
  'APT41 is a unique Chinese threat actor conducting both state-sponsored espionage and financially motivated cybercrime. Operating with apparent MSS ties, they target intellectual property and sensitive data while simultaneously running sideline criminal operations — a dual mandate rare among nation-state actors.',
  'China''s most versatile threat — state spy and cybercriminal rolled into one.',
  'LEGENDARY',
  '[{"source":"mitre","sourceId":"G0096","fetchedAt":"2024-01-01T00:00:00Z","url":"https://attack.mitre.org/groups/G0096/"}]',
  'WHITE',
  NOW()
),
(
  'scattered-spider',
  'Scattered Spider',
  '["UNC3944","Starfraud","Muddled Libra","Roasted 0ktapus","Scatter Swine"]',
  NULL,
  'Unknown', NULL,
  '["financial"]',
  7, 'High',
  '2022', '2024',
  '["Technology","Hospitality","Gaming","Telecommunications","Finance"]',
  '["United States","United Kingdom","Canada"]',
  '["Okta phishing kits","AnyDesk","RMM tools","Telegram","BlackCat/ALPHV"]',
  '[
    {"techniqueId":"T1621","techniqueName":"Multi-Factor Authentication Request Generation","tactic":"Credential Access"},
    {"techniqueId":"T1534","techniqueName":"Internal Spearphishing","tactic":"Lateral Movement"},
    {"techniqueId":"T1657","techniqueName":"Financial Theft","tactic":"Impact"},
    {"techniqueId":"T1586","techniqueName":"Compromise Accounts","tactic":"Resource Development"}
  ]',
  '[
    {"name":"Twilio / Okta Attacks","year":"2022","description":"MFA fatigue and smishing campaign compromising Twilio, Okta, and 130+ downstream customers."},
    {"name":"MGM Resorts","year":"2023","description":"Social-engineered MGM IT helpdesk, deploying BlackCat ransomware and causing $100M+ in damages."},
    {"name":"Caesars Entertainment","year":"2023","description":"Extorted Caesars for $15M ransom after compromising loyalty programme data."}
  ]',
  'Scattered Spider is a loosely affiliated English-speaking cybercriminal group known for sophisticated social engineering, MFA bypass, and partnering with ransomware-as-a-service operations. Despite lacking nation-state resources, their social engineering prowess has enabled breaches of some of the world''s largest corporations.',
  'No state sponsor, no problem — social engineering at enterprise scale.',
  'EPIC',
  '[{"source":"manual","fetchedAt":"2024-01-01T00:00:00Z","url":"https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a"}]',
  'WHITE',
  NOW()
),
(
  'sandworm',
  'Sandworm',
  '["Voodoo Bear","IRIDIUM","Seashell Blizzard","TeleBots","BlackEnergy Group"]',
  'G0034',
  'Russia', 'RU',
  '["sabotage","espionage","military"]',
  10, 'Nation-State Elite',
  '2009', '2024',
  '["Energy","Critical Infrastructure","Government","Media","Military"]',
  '["Ukraine","Europe","United States"]',
  '["BlackEnergy","Industroyer","NotPetya","Olympic Destroyer","Cyclops Blink","Prestige"]',
  '[
    {"techniqueId":"T1499","techniqueName":"Endpoint Denial of Service","tactic":"Impact"},
    {"techniqueId":"T1485","techniqueName":"Data Destruction","tactic":"Impact"},
    {"techniqueId":"T1565","techniqueName":"Data Manipulation","tactic":"Impact"},
    {"techniqueId":"T1489","techniqueName":"Service Stop","tactic":"Impact"}
  ]',
  '[
    {"name":"Ukraine Power Grid","year":"2015","description":"First confirmed cyberattack to cause a power outage, leaving 230,000 Ukrainians without electricity."},
    {"name":"NotPetya","year":"2017","description":"Destructive wiper disguised as ransomware; $10B in global damages, the costliest cyberattack in history."},
    {"name":"Industroyer2","year":"2022","description":"Attempted to destroy high-voltage electrical substations in Ukraine during the Russian invasion."}
  ]',
  'Sandworm is a Russian GRU Unit 74455 threat group specialising in destructive attacks on critical infrastructure. Responsible for the most damaging cyberattacks in history — NotPetya and repeated Ukrainian power grid attacks — they represent the most dangerous destructive cyber capability of any nation-state.',
  'The architects of NotPetya and the power grid attacks — destruction is the mission.',
  'MYTHIC',
  '[{"source":"mitre","sourceId":"G0034","fetchedAt":"2024-01-01T00:00:00Z","url":"https://attack.mitre.org/groups/G0034/"}]',
  'WHITE',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  canonical_name   = EXCLUDED.canonical_name,
  aliases          = EXCLUDED.aliases,
  motivation       = EXCLUDED.motivation,
  threat_level     = EXCLUDED.threat_level,
  sophistication   = EXCLUDED.sophistication,
  ttps             = EXCLUDED.ttps,
  campaigns        = EXCLUDED.campaigns,
  description      = EXCLUDED.description,
  tagline          = EXCLUDED.tagline,
  rarity           = EXCLUDED.rarity,
  sources          = EXCLUDED.sources,
  last_updated     = NOW();
