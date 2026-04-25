# ThreatDex — Simplification Plan

> Full architecture rewrite: single-language TypeScript stack, minimal dependencies,
> Vite-native, Netlify-hosted.
>
> **Guiding principles:** simplicity, single language (TypeScript), fewer moving parts,
> no infrastructure to manage.

---

## Current State

The existing codebase is ~95% feature-complete across a dual-language monorepo (Next.js +
FastAPI + 6 Python workers). Nothing is published. The implementation serves as a working
reference for the rewrite — the data models, UI component logic, worker algorithms, and
business rules are all proven and can be ported directly.

---

## Target Stack

| Layer | Technology | Replaces |
|---|---|---|
| Framework | React Router v7 (Vite, SSR) | Next.js 14 |
| Styling | Tailwind CSS v4 (Vite plugin) | Tailwind v3 + PostCSS + autoprefixer |
| Database | Supabase (managed Postgres + auto-REST) | FastAPI + SQLAlchemy + Alembic + psycopg2 |
| Data sync workers | TypeScript scripts via `tsx` | Python workers + Celery + Redis |
| Image generation | `openai` npm package | Python Celery worker + `openai` pip package |
| Testing | Vitest + Playwright | Vitest + Playwright + pytest |
| Package manager | pnpm (single package) | pnpm workspaces + pip + 7 requirements.txt |
| Hosting | Netlify (edge SSR) | Docker Compose (5 services) |
| CI | GitHub Actions | GitHub Actions (simplified) |

**Languages:** TypeScript only. Zero Python.

---

## 1. Frontend: Next.js → React Router v7

React Router v7 (formerly Remix) is the right Vite-native replacement:

- **Vite under the hood** — fast HMR, native ESM, simple config
- **SSR preserved** — critical for SEO; every actor page (APT28, Lazarus Group, etc.)
  needs a proper `<title>`, `<meta description>`, and OpenGraph tags for social sharing
- **Official Netlify adapter** — `@react-router/netlify` deploys SSR to Netlify edge
  functions natively
- **File-based routing** — same mental model as Next.js App Router
- **Loaders replace Server Components** — data fetching moves to `loader()` functions
  that run server-side and return typed data to components

### Migration notes

| Next.js concept | React Router v7 equivalent |
|---|---|
| `app/page.tsx` | `app/routes/_index.tsx` |
| `app/actors/[id]/page.tsx` | `app/routes/actors.$id.tsx` |
| `generateMetadata()` | `meta()` export |
| Server Components | `loader()` functions |
| `next/image` | Standard `<img>` or a lightweight lazy-load wrapper |
| `next/link` | `<Link>` from `react-router` |
| `useRouter()` | `useNavigate()` / `useSearchParams()` |

### Why not a plain Vite SPA?

A pure SPA loses server-side rendering. For ThreatDex, SSR matters because:

- Shared actor links should render OpenGraph cards (image, title, description) for
  Slack/Twitter/Discord previews
- Search engines should index actor pages directly
- Initial page load with data is faster (no client-side fetch waterfall)

---

## 2. Backend: Full Python Stack → Supabase

This is the single biggest simplification. One npm package (`@supabase/supabase-js`)
replaces the entire Python backend.

### What Supabase replaces

| Eliminated | How Supabase handles it |
|---|---|
| FastAPI | Auto-generated REST API from Postgres schema (PostgREST) |
| SQLAlchemy | Direct queries via `supabase.from('actors').select()` |
| Alembic | Supabase migration system (`supabase db diff`, `supabase db push`) |
| psycopg2 | Supabase JS client handles connections |
| Celery + Redis | Not needed — workers run as GitHub Actions cron jobs |
| Pydantic request/response schemas | Zod schemas (already exist) validate on the client |

### API endpoints → Supabase queries in loaders

The current FastAPI endpoints become direct Supabase calls inside React Router loaders:

```typescript
// Before: GET /api/actors?country=RU&motivation=espionage&limit=20&offset=0
// After: React Router loader
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const country = url.searchParams.get("country");
  const motivation = url.searchParams.get("motivation");

  let query = supabase.from("actors").select("*", { count: "exact" });
  if (country) query = query.eq("country_code", country);
  if (motivation) query = query.contains("motivation", [motivation]);

  const { data, count } = await query.range(offset, offset + limit - 1);
  return { items: data, total: count };
}
```

### Full-text search

The current Python backend has custom search logic across names, aliases, tools, and
techniques. In Supabase this requires a one-time setup:

1. Add a `tsvector` column to the `actors` table
2. Create a trigger to auto-populate it from `canonical_name`, `aliases`, `tools`,
   `description`
3. Create a GIN index on the column
4. Query with `supabase.rpc('search_actors', { query: 'lazarus' })`

This is a Postgres function (~15 lines of SQL), not application code.

### Admin sync trigger

The current `POST /api/admin/sync/{source}` endpoint triggers workers on demand. Two
replacement options:

- **GitHub Actions `workflow_dispatch`** — trigger syncs manually from the Actions UI or
  via `gh workflow run sync.yml -f source=mitre`
- **Supabase Edge Function** — a lightweight serverless endpoint that calls the worker
  logic directly (only needed if you want a UI button for manual sync)

### Card PNG endpoints — dropped

The `GET /api/actors/{id}/card/front` and `GET /api/actors/{id}/card/back` endpoints
used Pillow + Jinja2 to render card PNGs server-side. These are replaced entirely by
`html2canvas` in the frontend, which is already implemented and produces higher-fidelity
output since it captures the actual rendered CSS.

---

## 3. Workers: Python → TypeScript

The existing Python workers are standalone scripts that fetch data from external sources,
normalize it, and upsert into Postgres. The logic is straightforward and ports cleanly
to TypeScript.

### Worker-by-worker migration

| Worker | What it does | Python deps replaced | TypeScript equivalent |
|---|---|---|---|
| `mitre-sync` | Fetches STIX 2.1 JSON bundles from MITRE ATT&CK | `taxii2-client`, `requests` | `fetch` (STIX is just JSON) |
| `etda-sync` | Scrapes HTML from apt.etda.or.th | `beautifulsoup4`, `requests` | `cheerio` + `fetch` |
| `otx-sync` | Calls AlienVault OTX REST API | `requests` | `fetch` |
| `image-gen` | Generates hero images via OpenAI API | `openai`, `celery`, `redis`, `pillow` | `openai` npm package |
| `shared/dedup` | Alias matching + actor merge logic | pure Python | Pure TypeScript (direct port) |
| `shared/rarity` | Computes rarity tier + threat level | pure Python | Pure TypeScript (direct port) |

### Workers that can wait

| Worker | Why defer |
|---|---|
| `misp-sync` | Requires a self-hosted MISP instance + API key. Add as optional connector later. |
| `opencti-sync` | Requires a self-hosted OpenCTI instance + API key. Add as optional connector later. |

Start with the three public sources (MITRE, ETDA, OTX). These require no API keys or
private infrastructure and provide comprehensive actor coverage.

### How workers run

Workers become TypeScript files executed via `tsx` in GitHub Actions:

```yaml
# .github/workflows/sync.yml
name: Nightly data sync
on:
  schedule:
    - cron: "0 3 * * *"
  workflow_dispatch:
    inputs:
      source:
        type: choice
        options: [mitre, etda, otx, all]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm tsx workers/mitre-sync.ts
        if: inputs.source == 'mitre' || inputs.source == 'all' || github.event_name == 'schedule'
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

No Docker, no Celery, no Redis. Just Node running a script.

---

## 4. Monorepo → Flat Project

With a single language and no separate backend service, the monorepo adds complexity
for zero benefit.

### New structure

```
threatdex/
├── app/                        # React Router v7 routes
│   ├── routes/
│   │   ├── _index.tsx          # Home — card grid + search + filters
│   │   └── actors.$id.tsx      # Actor detail — flippable card
│   ├── components/
│   │   ├── ThreatActorCard.tsx
│   │   ├── CardFront.tsx
│   │   ├── CardBack.tsx
│   │   ├── RarityBadge.tsx
│   │   ├── ThreatLevelBar.tsx
│   │   ├── SearchBar.tsx
│   │   ├── FilterPanel.tsx
│   │   └── CardSkeleton.tsx
│   ├── lib/
│   │   ├── supabase.server.ts  # Supabase client (server-side only)
│   │   └── supabase.client.ts  # Supabase client (browser, if needed)
│   ├── schema/
│   │   └── index.ts            # Zod schemas + TypeScript types (ported from packages/schema)
│   ├── root.tsx
│   └── entry.server.tsx
├── workers/
│   ├── mitre-sync.ts
│   ├── etda-sync.ts
│   ├── otx-sync.ts
│   ├── image-gen.ts
│   └── shared/
│       ├── supabase.ts         # Supabase admin client for workers
│       ├── dedup.ts            # Alias deduplication + actor merge
│       └── rarity.ts           # Rarity tier + threat level computation
├── supabase/
│   ├── migrations/             # SQL migration files
│   └── seed.sql                # Optional seed data
├── tests/
│   ├── components/             # Vitest component tests
│   ├── workers/                # Vitest worker tests (mocked fetch)
│   └── e2e/                    # Playwright smoke tests
├── public/                     # Static assets
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + typecheck + test
│       └── sync.yml            # Nightly data sync cron
├── package.json                # Single package.json
├── vite.config.ts
├── react-router.config.ts
├── tailwind.config.ts          # Or CSS-only config with Tailwind v4
├── tsconfig.json
├── .env.example
└── README.md
```

### What's removed

| Removed | Why |
|---|---|
| `apps/api/` (entire directory) | Supabase replaces the Python API |
| `apps/web/` nesting | App lives at root now |
| `packages/schema/` | Moved to `app/schema/` |
| `packages/ui/` | Moved to `app/components/` |
| `workers/` Python files | Rewritten as TypeScript in `workers/` |
| `infra/docker-compose.yml` | No local services to orchestrate |
| `turbo.json` | No monorepo to orchestrate |
| `pnpm-workspace.yaml` | Single package |
| `tsup` config | No internal packages to bundle |
| All Dockerfiles | Netlify handles builds; workers run in GH Actions |
| `alembic/` + `alembic.ini` | Supabase handles migrations |
| `postcss.config.js` | Tailwind v4 Vite plugin handles this |
| All `requirements.txt` (7 files) | Zero Python |
| `ruff.toml` / Ruff config | Zero Python |

---

## 5. Tailwind v4

Tailwind v4 ships a Vite plugin that eliminates PostCSS and autoprefixer entirely:

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

Two fewer packages, one fewer config file. The design system (colors, typography) ports
directly — just move the custom values into `@theme` in your CSS file or
`tailwind.config.ts`.

---

## Net Dependency Change

### JavaScript — removed

| Package | Reason |
|---|---|
| `next` | Replaced by React Router v7 |
| `eslint-config-next` | Next.js-specific |
| `turbo` | No monorepo |
| `tsup` | No internal packages |
| `postcss` | Tailwind v4 Vite plugin |
| `autoprefixer` | Tailwind v4 Vite plugin |

### JavaScript — added

| Package | Purpose |
|---|---|
| `react-router` | Vite-native framework with SSR |
| `@react-router/netlify` | Netlify SSR adapter |
| `@supabase/supabase-js` | Database client (replaces entire Python backend) |
| `cheerio` | HTML parsing for ETDA scraper (replaces BeautifulSoup) |
| `tsx` | Run TypeScript worker scripts directly |
| `openai` | AI image generation (replaces Python `openai` package) |

### Python — entire stack eliminated

All 24 Python packages removed. Zero `requirements.txt` files. Zero Python runtime in CI.

`fastapi` · `uvicorn` · `sqlalchemy` · `alembic` · `psycopg2-binary` · `pydantic` ·
`pydantic-settings` · `celery` · `redis` · `httpx` · `aiohttp` · `jinja2` · `pillow` ·
`python-multipart` · `anyio` · `pytest-asyncio` · `pytest-cov` · `ruff` ·
`taxii2-client` · `beautifulsoup4` · `python-slugify` · `openai` · `pymisp` · `pycti`

### Infrastructure removed

- `infra/docker-compose.yml` — no local Postgres/Redis to manage
- All Dockerfiles — Netlify builds the app; GitHub Actions runs workers
- Redis — not needed without Celery
- Celery — replaced by GitHub Actions cron

---

## What Carries Over (logic, not code)

The existing codebase is a reference implementation. These pieces port directly:

| Area | Notes |
|---|---|
| UI component logic | `CardFront`, `CardBack`, `ThreatActorCard`, flip animation, `RarityBadge`, `ThreatLevelBar` — same React, same Tailwind classes |
| Zod schemas | `ThreatActorSchema`, `CampaignSchema`, `TTPUsageSchema`, etc. — copy as-is |
| Brand / design system | All color tokens, typography choices, animation timings — unchanged |
| Worker algorithms | MITRE STIX parsing, ETDA HTML scraping, OTX API mapping, dedup logic, rarity computation — same logic, different language |
| `html2canvas` card export | Already frontend-only, works identically |
| Vitest component tests | Port with minor import path updates |
| Playwright e2e tests | Update URLs/selectors if routes change, otherwise same |

---

## Before / After

| Area | Before | After |
|---|---|---|
| Languages | TypeScript + Python | TypeScript only |
| Frontend framework | Next.js 14 (webpack) | React Router v7 (Vite) |
| Backend | FastAPI + 6 Python files | Supabase (zero backend code) |
| Database | Self-managed PostgreSQL + Alembic | Supabase managed Postgres |
| Queue / workers | Redis + Celery + Python scripts | GitHub Actions + TypeScript scripts |
| Local dev | `docker compose up` (5 services) | `pnpm dev` + `supabase start` |
| Repo structure | Turborepo monorepo (4 packages) | Flat single project |
| `package.json` files | 4 | 1 |
| `requirements.txt` files | 7 | 0 |
| Config files (approx) | 18 | 8 |
| JS packages (approx) | 20+ | ~14 |
| Python packages | 24 | 0 |
| Docker images | 3 | 0 |
| Deployment | Manual (Docker) | Netlify (auto-deploy on push) |

---

## Environment Variables (simplified)

```bash
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...                     # Public, used in browser
SUPABASE_SERVICE_KEY=eyJ...                  # Private, used in workers + server loaders

# CTI sources (optional — workers skip gracefully if missing)
OTX_API_KEY=

# Image generation (optional — skip if missing)
OPENAI_API_KEY=

# Future optional connectors
MISP_URL=
MISP_API_KEY=
OPENCTI_URL=
OPENCTI_API_KEY=
```

No `DATABASE_URL`, no `REDIS_URL`, no `ADMIN_SECRET`. Supabase handles auth and
connection management.

---

## Migration Order

### Phase 1 — Foundation (do first, unblocks everything)

1. **Set up Supabase project** — create the project, define the `actors` and `sync_log`
   tables, set up full-text search (`tsvector` + GIN index), run seed data if available
2. **Scaffold React Router v7 app** — `npx create-react-router@latest`, configure Vite,
   Tailwind v4, Netlify adapter

### Phase 2 — Port the UI

3. **Move Zod schemas** — copy `packages/schema/src/index.ts` to `app/schema/index.ts`,
   update imports
4. **Move UI components** — port `CardFront`, `CardBack`, `ThreatActorCard`,
   `RarityBadge`, `ThreatLevelBar` into `app/components/`
5. **Build routes** — create home page (card grid + search + filters) and actor detail
   page with Supabase loaders
6. **Card download** — wire up `html2canvas` export

### Phase 3 — Port the workers

7. **Rewrite MITRE sync** — fetch STIX JSON, parse intrusion-set objects, upsert via
   Supabase client
8. **Rewrite ETDA sync** — `cheerio` + `fetch`, scrape actor cards, upsert
9. **Rewrite OTX sync** — REST API calls, normalize, upsert
10. **Port dedup + rarity logic** — pure TypeScript, direct translation from Python
11. **Set up GitHub Actions cron** — `sync.yml` with `workflow_dispatch` support

### Phase 4 — Polish

12. **Tests** — Vitest for components + workers, Playwright for e2e
13. **CI** — GitHub Actions: lint (ESLint) + typecheck (tsc) + test (Vitest) + build
14. **Deploy** — connect Netlify to the repo, set environment variables, verify SSR
15. **Image generation** — port the OpenAI worker to TypeScript (optional, can defer)

### Phase 5 — Future (not part of initial rewrite)

- MISP connector (requires self-hosted instance)
- OpenCTI connector (requires self-hosted instance)
- Supabase Row Level Security if auth is added later
- Realtime subscriptions for live sync status

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Supabase vendor lock-in | Supabase is open source and backed by standard Postgres. The schema and queries are portable to any Postgres host. Self-hosting Supabase is an option if needed. |
| React Router v7 is newer than Next.js | RR v7 is Remix renamed — Remix has been production-stable since 2022. The community and docs are mature. |
| Losing the existing Python test suite (100+ tests) | The tests validate the same logic being rewritten in TypeScript. Port the test cases (inputs/expected outputs), not the test framework. |
| Full-text search complexity in Supabase | One-time SQL setup (~15 lines). Postgres `tsvector` is battle-tested and more capable than the existing Python implementation. |
| Worker reliability without Celery | GitHub Actions has built-in retry, logging, and alerting. For a nightly cron job, this is simpler and more reliable than self-managed Celery. |
