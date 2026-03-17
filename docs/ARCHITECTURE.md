# ThreatDex — Architecture

## System Overview

```
                          ┌─────────────────────────────────────────────────┐
                          │                   Clients                        │
                          │         (Browser / API consumers)                │
                          └────────────────────┬────────────────────────────┘
                                               │ HTTPS
                          ┌────────────────────▼────────────────────────────┐
                          │         React Router v7 (Netlify Edge SSR)       │
                          │               port 5173 (dev)                    │
                          │                                                  │
                          │  • Server-side loaders fetch data from Supabase  │
                          │  • Card grid, actor detail, search UI            │
                          │  • Tailwind CSS v4 + brand design system         │
                          └────────────────────┬────────────────────────────┘
                                               │ Supabase JS SDK (HTTPS)
                          ┌────────────────────▼────────────────────────────┐
                          │                  Supabase                        │
                          │                                                  │
                          │  • Managed PostgreSQL 15                         │
                          │  • Auto-generated REST API                       │
                          │  • Row-level security (RLS) policies             │
                          │  • Supabase Storage (actor hero images)          │
                          └────────────────────┬────────────────────────────┘
                                               │ upsert (SUPABASE_SERVICE_KEY)
                          ┌────────────────────▼────────────────────────────┐
                          │           TypeScript Worker Scripts              │
                          │       workers/*.ts  —  run via tsx               │
                          │                                                  │
                          │  • mitre-sync  — MITRE ATT&CK STIX ingestion    │
                          │  • etda-sync   — ETDA APT scraper               │
                          │  • otx-sync    — AlienVault OTX connector        │
                          │  • image-gen   — AI hero image generation        │
                          └───────────────────────┬─────────────────────────┘
                                                  │ outbound HTTP
                          ┌───────────────────────▼─────────────────────────┐
                          │              External CTI Sources                │
                          │                                                  │
                          │  • MITRE ATT&CK  — github.com/mitre/cti (STIX)  │
                          │  • ETDA          — apt.etda.or.th                │
                          │  • AlienVault OTX — otx.alienvault.com (API key)│
                          │  • MISP          — self-hosted (optional)        │
                          │  • OpenCTI       — self-hosted (optional)        │
                          └─────────────────────────────────────────────────┘
```

---

## Component Descriptions

### app/ — React Router v7 Frontend

The web application is a React Router v7 project using Vite SSR, deployed on
Netlify as an edge function. It renders threat actor data as interactive "trading
cards" with a flippable front/back layout.

Key responsibilities:
- Server-side loaders that query Supabase for actor data
- Card grid home page with search and filter controls
- Individual actor detail pages at `/actors/:id`
- Card flip animation (CSS 3D transform)
- PNG export via `html2canvas`
- SEO metadata via React Router `meta` exports

All data access goes through `app/lib/supabase.server.ts` (server-side) and
`app/lib/supabase.client.ts` (browser-side for client interactions).

### Supabase — Database + API

Supabase provides managed PostgreSQL 15 with an auto-generated REST API. ThreatDex
uses it as the sole data store — there is no separate API server.

Key responsibilities:
- `actors` table storing all `ThreatActor` records
- Row-level security policies ensuring public read access to TLP:WHITE data
- Supabase Storage for AI-generated hero images
- `sync_log` table tracking worker sync history

Schema is managed via migrations in `supabase/migrations/`.

### workers/ — Data Ingestion Scripts

TypeScript scripts executed via `tsx`. They run as one-shot processes (not
long-running daemons), triggered by GitHub Actions cron or manually.

Each worker:
1. Fetches raw data from its CTI source
2. Normalises it to the canonical `ThreatActor` schema
3. Runs alias deduplication against existing records
4. Upserts into Supabase using the service key

Workers use shared utilities in `workers/shared/`:
- `supabase.ts` — Supabase admin client
- `models.ts` — TypeScript types and DB record conversion
- `dedup.ts` — alias matching and actor merge logic
- `rarity.ts` — threat level and rarity tier computation

### workers/mitre-sync.ts

Fetches the MITRE ATT&CK Enterprise STIX bundle from the GitHub-hosted CDN:

```
https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json
```

This is more reliable in CI environments than live TAXII queries. Parses
`intrusion-set` objects and their `uses` relationships to extract TTPs, tools,
and campaigns.

### workers/etda-sync.ts

Scrapes the ETDA APT Group tracker (`apt.etda.or.th`). Fetches the group listing
and individual showcard pages using `cheerio`. Falls back gracefully if the site
is unreachable.

### workers/otx-sync.ts

Connector for the AlienVault OTX API. Feature-flagged off if `OTX_API_KEY` is not
present. Enriches existing actor records with additional aliases, tools, and TTPs
from community-contributed pulses.

### workers/image-gen.ts

Given a `ThreatActor`, builds a prompt from the actor's attributes and calls
OpenAI DALL-E. Stores the result in Supabase Storage and updates the `imageUrl`
field on the actor record. Feature-flagged off if `OPENAI_API_KEY` is absent.

---

## Data Flow

### Ingestion path (CTI source → database)

```
1. Trigger       GitHub Actions cron (2am UTC) or manual: pnpm workers:mitre
2. Fetch         Worker makes outbound HTTP call to the CTI source
3. Normalise     Raw source data is mapped to the canonical ThreatActor schema
4. Dedup         Alias matching checks whether the actor already exists
5. Upsert        Supabase upsert merges the record; source attribution is appended
6. Image queue   If actor has no imageUrl, image-gen.ts can be run separately
```

### Read path (browser → Supabase)

```
1. Browser       User loads / or /actors/:id
2. Netlify Edge  React Router server loader runs at the edge
3. Supabase SDK  Loader queries Supabase PostgreSQL via the JS SDK
4. Serialise     React Router serialises the loader data to the client
5. Render        Card component renders with actor data
```

---

## Key Design Decisions

### TypeScript-only stack

The codebase uses TypeScript for both the frontend and workers. This eliminates
the dual-language complexity of a Python backend, shares types across the entire
project, and reduces the number of tooling configurations.

### Supabase as the backend

Supabase replaces the original FastAPI + SQLAlchemy + Alembic + Redis + Celery
stack. It provides managed PostgreSQL, an auto-generated REST API, row-level
security, and Storage — without any server code to maintain. Migration files are
version-controlled in `supabase/migrations/`.

### Workers as one-shot scripts

Instead of long-running Celery workers, data ingestion is done by TypeScript
scripts that run to completion and exit. GitHub Actions handles scheduling and
retries. This is simpler to reason about and debug.

### Feature-flagged connectors

All CTI source workers check for their required API key before running. If a key
is absent, the worker logs a warning and exits cleanly — the application never
fails due to a missing optional credential.

### Canonical data model enforced at ingestion

Every worker maps its source-specific data to the shared `ThreatActor` schema
(defined in `app/schema/index.ts`) before writing to the database. The frontend
always works with a consistent shape regardless of data source.

### TLP-aware data handling

Each actor record carries a TLP classification (`WHITE` or `GREEN`). All data
ingested by default workers is TLP:WHITE. RLS policies enforce public read access
for TLP:WHITE records only.

### Alias deduplication at merge time

When two sources refer to the same actor by different names (e.g., "APT28" vs
"Fancy Bear" vs "Sofacy"), the deduplication logic in `workers/shared/dedup.ts`
reconciles them into a single canonical record with all aliases preserved and
source attributions merged.
