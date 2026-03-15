# ThreatDex — Architecture

## System Overview

```
                          ┌─────────────────────────────────────────────────┐
                          │                   Clients                        │
                          │         (Browser / API consumers)                │
                          └────────────────────┬────────────────────────────┘
                                               │ HTTPS
                          ┌────────────────────▼────────────────────────────┐
                          │              Next.js 14 (Web)                    │
                          │          apps/web  —  port 3000                  │
                          │                                                  │
                          │  • App Router (RSC + Client Components)          │
                          │  • Card grid, actor detail, search UI            │
                          │  • Tailwind CSS + brand design system            │
                          └────────────────────┬────────────────────────────┘
                                               │ HTTP (NEXT_PUBLIC_API_URL)
                          ┌────────────────────▼────────────────────────────┐
                          │              FastAPI (API)                        │
                          │          apps/api  —  port 8000                  │
                          │                                                  │
                          │  • REST endpoints (see docs/API.md)              │
                          │  • SQLAlchemy 2 ORM, Pydantic v2 schemas         │
                          │  • Alembic database migrations                   │
                          │  • Uvicorn ASGI server                           │
                          └──────────┬──────────────────────┬───────────────┘
                                     │                      │
                   ┌─────────────────▼──────┐   ┌──────────▼──────────────┐
                   │     PostgreSQL 15       │   │       Redis 7           │
                   │      port 5432         │   │       port 6379         │
                   │                        │   │                         │
                   │  • Primary data store  │   │  • Celery broker        │
                   │  • Actor records       │   │  • Task result backend  │
                   │  • TTP / campaign data │   │  • API response cache   │
                   └────────────┬───────────┘   └──────────┬──────────────┘
                                │                          │
                   ┌────────────▼──────────────────────────▼───────────────┐
                   │              Celery Workers                             │
                   │         apps/api  +  workers/*                         │
                   │                                                         │
                   │  • mitre-sync  — TAXII 2.1 ingestion                   │
                   │  • etda-sync   — ETDA APT scraper                      │
                   │  • otx-sync    — AlienVault OTX connector               │
                   │  • image-gen   — AI hero image generation queue         │
                   └───────────────────────┬─────────────────────────────── ┘
                                           │ outbound HTTP
                   ┌───────────────────────▼─────────────────────────────── ┐
                   │                 External CTI Sources                    │
                   │                                                         │
                   │  • MITRE ATT&CK  — attack-taxii.mitre.org (TAXII 2.1)  │
                   │  • ETDA          — apt.etda.or.th                       │
                   │  • AlienVault OTX — otx.alienvault.com (API key)       │
                   │  • MISP          — self-hosted (optional)               │
                   │  • OpenCTI       — self-hosted (optional)               │
                   └─────────────────────────────────────────────────────── ┘
```

---

## Component Descriptions

### apps/web — Next.js 14 Frontend

The web application is a Next.js 14 project using the App Router. It renders threat
actor data as interactive "trading cards" with a flippable front/back layout.

Key responsibilities:
- Card grid home page with search and filter controls
- Individual actor detail pages at `/actors/[id]`
- Card flip animation (CSS 3D transform)
- PNG export via `html2canvas`
- SEO metadata via `generateMetadata()`
- Mobile responsive layout

All API calls target `NEXT_PUBLIC_API_URL` (the FastAPI backend). Server Components
are used for initial data fetching; client components handle interactivity.

### apps/api — FastAPI Backend

The API layer is a Python 3.11 FastAPI application serving JSON over HTTP. It is
the single source of truth for all data access from the frontend.

Key responsibilities:
- REST endpoints for actors, search, sources, and admin sync triggers
- SQLAlchemy 2 ORM models mapped to PostgreSQL
- Pydantic v2 request/response validation
- Alembic migration management
- Celery task dispatch (triggering workers)
- OpenAPI documentation auto-generated at `/docs`

### packages/schema — Shared TypeScript Schemas

Zod schemas and TypeScript interfaces that define the canonical `ThreatActor` data
model. Both the web app and any TypeScript tooling import from this package, ensuring
the frontend's type expectations always match the API's output shape.

### packages/ui — Shared React Components

Reusable React components for the card UI (front face, back face, flip wrapper,
rarity badge, stat bar). Consumed by `apps/web` and usable in Storybook or
standalone contexts.

### workers/mitre-sync

A Python worker that connects to the MITRE ATT&CK TAXII 2.1 server
(`attack-taxii.mitre.org`) and ingests `intrusion-set` objects. It normalises them
into the canonical `ThreatActor` schema and upserts into PostgreSQL.

### workers/etda-sync

A Python scraper for the ETDA APT Group tracker (`apt.etda.or.th`). It fetches the
group listing and individual showcard pages, normalises the data, and upserts into
PostgreSQL. Falls back gracefully if the site is unreachable.

### workers/otx-sync

A Python connector for the AlienVault OTX API. Feature-flagged off if `OTX_API_KEY`
is not present in the environment. Pulls pulse data for threat actor groups and
enriches existing records with additional aliases, tools, and TTPs.

### workers/image-gen

A Celery worker that accepts image generation jobs from the queue. Given a
`ThreatActor`, it builds a prompt from the actor's attributes and calls the
configured image generation API (OpenAI DALL-E or Stability AI). The result is
stored in Cloudflare R2 (or local filesystem in development) and the `imageUrl`
field on the actor record is updated. Feature-flagged off if `OPENAI_API_KEY` is
absent.

---

## Data Flow

### Ingestion path (CTI source → database)

```
1. Trigger         GitHub Actions cron (2am UTC) or POST /api/admin/sync/{source}
2. Dispatch        FastAPI enqueues a Celery task for the requested source
3. Fetch           Worker makes outbound HTTP/TAXII call to the CTI source
4. Normalise       Raw source data is mapped to the canonical ThreatActor schema
5. Dedup           Alias matching logic checks whether the actor already exists
6. Upsert          SQLAlchemy upserts the record; source attribution is appended
7. Image queue     If actor has no imageUrl, an image-gen task is enqueued
```

### Read path (frontend → API → database)

```
1. Browser         User loads /actors or /actors/[id]
2. Next.js RSC     Server Component calls GET /api/actors or /api/actors/{id}
3. FastAPI         Handler queries PostgreSQL via SQLAlchemy, returns JSON
4. Serialisation   Pydantic v2 validates and serialises the response
5. Render          Next.js renders the card component with the actor data
```

---

## Key Design Decisions

### Monorepo with pnpm workspaces + Turborepo
All JavaScript packages live in a single repo with shared TypeScript types. Turborepo
provides task parallelisation and caching for build, lint, test, and typecheck across
all workspaces.

### Separate API and web processes
The FastAPI backend and Next.js frontend are deployed independently. This allows the
API to be consumed by other clients (CLI tools, SIEM integrations) and enables
independent scaling.

### Feature-flagged connectors
All CTI source connectors check for their required API key at startup. If a key is
absent, the connector logs a warning and is skipped — the application never crashes
due to a missing optional credential.

### Canonical data model enforced at ingestion
Every worker is responsible for mapping its source-specific data format to the shared
`ThreatActor` schema before writing to the database. The API layer never needs to
know which source an actor came from.

### TLP-aware data handling
Each actor record carries a TLP classification (`WHITE` or `GREEN`). The API and
frontend respect these values, and future versions will enforce access controls based
on TLP level.

### Alias deduplication at merge time
When two sources refer to the same actor by different names (e.g., "APT28" vs
"Fancy Bear" vs "Sofacy"), the alias deduplication worker reconciles them into a
single canonical record with all aliases preserved and source attributions merged.
